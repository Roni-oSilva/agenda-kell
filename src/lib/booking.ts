import 'server-only';
import { db, getSettings, HttpError, slotsFor, audit } from './server';
import { toInstant, normalizePhone, dateOfInstant } from './time';
import { isValidCpf } from './cpf';
import { queueConfirmation } from './notify';

export type Service = {
  id: string; name: string; price_cents: number; duration_min: number; active: boolean;
  deposit_mode: 'none' | 'fixed' | 'percent' | 'full'; deposit_value: number; deposit_required: boolean; return_days: number | null;
};

export function depositFor(s: Pick<Service, 'price_cents' | 'deposit_mode' | 'deposit_value'>): number {
  switch (s.deposit_mode) {
    case 'fixed': return Math.min(s.deposit_value, s.price_cents);
    case 'percent': return Math.min(s.price_cents, Math.round((s.price_cents * s.deposit_value) / 100));
    case 'full': return s.price_cents;
    default: return 0;
  }
}

export async function upsertCustomer(name: string, rawPhone: string, consent: boolean, extra: { cpf?: string; email?: string } = {}) {
  const cpf = extra.cpf ? extra.cpf.replace(/\D/g, '') : undefined;
  if (cpf && !isValidCpf(cpf)) throw new HttpError(400, 'CPF inválido.');
  const email = extra.email?.trim().toLowerCase() || undefined;
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new HttpError(400, 'WhatsApp inválido. Informe DDD + número.');
  // recorrente = mesmo telefone: nunca duplica cadastro
  const { data: existing } = await db().from('customers').select('*').eq('phone_e164', phone).maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (consent && !existing.whatsapp_consent) patch.whatsapp_consent = true;
    if (cpf && cpf !== existing.cpf) patch.cpf = cpf;
    if (email && email !== existing.email) patch.email = email;
    if (Object.keys(patch).length) await db().from('customers').update(patch).eq('id', existing.id);
    return { ...existing, ...patch, whatsapp_consent: existing.whatsapp_consent || consent };
  }
  const { data, error } = await db().from('customers').insert({ name: name.trim(), phone_e164: phone, whatsapp_consent: consent, cpf: cpf ?? null, email: email ?? null }).select('*').single();
  if (error?.code === '23505') { // corrida entre duas requisições do mesmo telefone
    const { data: again } = await db().from('customers').select('*').eq('phone_e164', phone).single();
    return again!;
  }
  if (error) throw error;
  return data;
}

export type CreateInput = {
  serviceId: string; date: string; time: string; name: string; phone: string; consent: boolean;
  policyAccepted: boolean; actor: 'cliente' | 'admin'; notes?: string; cpf?: string; email?: string;
};

export async function createBooking(i: CreateInput) {
  await db().rpc('expire_holds'); // libera reservas temporárias vencidas antes de checar conflito
  const settings = await getSettings();
  const { data: svc } = await db().from('services').select('*').eq('id', i.serviceId).maybeSingle();
  if (!svc || (!svc.active && i.actor === 'cliente')) throw new HttpError(404, 'Procedimento indisponível.');
  const service = svc as Service;

  if (i.actor === 'cliente') {
    if (!i.policyAccepted) throw new HttpError(400, 'É necessário aceitar a política de cancelamento.');
    const { slots } = await slotsFor(i.date, service.duration_min);
    if (!slots.includes(i.time)) throw new HttpError(409, 'Esse horário não está mais disponível. Escolha outro.');
  }
  const start = toInstant(i.date, i.time);
  const end = new Date(start.getTime() + service.duration_min * 60_000);
  if (i.actor === 'cliente' && start.getTime() < Date.now()) throw new HttpError(400, 'Data no passado.');

  const customer = await upsertCustomer(i.name, i.phone, i.consent, { cpf: i.cpf, email: i.email });
  const deposit = depositFor(service);
  const needsPayment = i.actor === 'cliente' && service.deposit_required && deposit > 0 && (settings.payment_methods.pix || settings.payment_methods.card);
  const hold = new Date(Date.now() + settings.booking.hold_minutes * 60_000);

  const { data: b, error } = await db().from('bookings').insert({
    customer_id: customer.id, service_id: service.id, service_name: service.name, duration_min: service.duration_min,
    total_cents: service.price_cents, deposit_cents: deposit, start_at: start.toISOString(), end_at: end.toISOString(),
    status: needsPayment ? 'aguardando_pagamento' : i.actor === 'admin' ? 'confirmado' : 'aguardando_confirmacao',
    hold_expires_at: needsPayment ? hold.toISOString() : null, policy_accepted_at: i.policyAccepted ? new Date().toISOString() : null,
    whatsapp_consent: customer.whatsapp_consent, notes: i.notes ?? null, created_by: i.actor,
  }).select('*').single();
  if (error) {
    if (error.code === '23P01') throw new HttpError(409, 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.');
    throw error;
  }
  await audit(i.actor, 'criar_agendamento', 'booking', b.id, { start: b.start_at });
  if (b.status === 'confirmado') await queueConfirmation(b.id);
  return { booking: b, needsPayment, customer };
}

/** Atualiza status e dispara os efeitos colaterais (confirmação, retorno, limpeza de lembretes). */
export async function setStatus(id: string, status: string, o: { reason?: string; by: string }) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'cancelado') { patch.cancel_reason = o.reason ?? null; patch.canceled_by = o.by; patch.hold_expires_at = null; }
  const { data: b, error } = await db().from('bookings').update(patch).eq('id', id).select('*').single();
  if (error) { if (error.code === '23P01') throw new HttpError(409, 'Conflito de horário.'); throw error; }
  await audit(o.by, `status:${status}`, 'booking', id, { reason: o.reason });
  if (status === 'confirmado') await queueConfirmation(id);
  if (status === 'cancelado' || status === 'nao_compareceu') {
    await db().from('notifications').update({ status: 'cancelado' }).eq('booking_id', id).eq('status', 'pendente');
  }
  if (status === 'concluido' && b.service_id) {
    const { data: s } = await db().from('services').select('return_days').eq('id', b.service_id).maybeSingle();
    if (s?.return_days) {
      const due = new Date(dateOfInstant(b.start_at) + 'T12:00:00Z'); due.setUTCDate(due.getUTCDate() + s.return_days);
      const { data: exists } = await db().from('followups').select('id').eq('booking_id', id).maybeSingle();
      if (!exists) await db().from('followups').insert({ booking_id: id, customer_id: b.customer_id, due_date: due.toISOString().slice(0, 10) });
    }
  }
  return b;
}

export async function reschedule(id: string, date: string, time: string, by: string) {
  const { data: cur } = await db().from('bookings').select('*').eq('id', id).single();
  if (!cur) throw new HttpError(404, 'Agendamento não encontrado');
  const start = toInstant(date, time), end = new Date(start.getTime() + cur.duration_min * 60_000);
  const { error } = await db().from('bookings').update({ start_at: start.toISOString(), end_at: end.toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { if (error.code === '23P01') throw new HttpError(409, 'Esse horário conflita com outro atendimento.'); throw error; }
  await db().from('notifications').update({ status: 'cancelado' }).eq('booking_id', id).eq('status', 'pendente').in('kind', ['reminder_24h', 'reminder_2h']);
  await audit(by, 'reagendar', 'booking', id, { de: cur.start_at, para: start.toISOString() });
}
