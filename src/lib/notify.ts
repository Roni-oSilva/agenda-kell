import 'server-only';
import { db, getSettings } from './server';
import { fmtDateBR, fmtTimeBR } from './time';

export type NotifKind = 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'waitlist' | 'followup' | 'manual';

/**
 * Parâmetros dos templates (cadastre-os na Meta nesta ordem, categoria UTILITY):
 *  confirmation / reminder_24h / reminder_2h: {{1}} nome, {{2}} data, {{3}} hora, {{4}} procedimento
 *  waitlist: {{1}} nome, {{2}} procedimento, {{3}} data, {{4}} hora, {{5}} link
 *  followup: {{1}} nome, {{2}} procedimento, {{3}} link
 */
export function previewBody(kind: NotifKind, p: string[], studio: string): string {
  const [a, b, c, d, e] = p;
  switch (kind) {
    case 'confirmation': return `Olá, ${a}! Seu horário está confirmado.\nData: ${b}\nHorário: ${c}\nProcedimento: ${d}\n${studio} te espera!`;
    case 'reminder_24h': return `Olá, ${a}!\nPassando para lembrar que você tem um horário agendado conosco amanhã!\nData: ${b}\nHorário: ${c}\nProcedimento: ${d}\nEstamos esperando por você!\nCaso precise conversar sobre seu horário, entre em contato conosco.`;
    case 'reminder_2h': return `Olá, ${a}! Seu horário é daqui a pouco!\n${b} ${c}\n${d}`;
    case 'waitlist': return `Olá, ${a}! Surgiu uma vaga para ${b} em ${c} às ${d}. Se quiser reservar, acesse: ${e}`;
    case 'followup': return `Olá, ${a}! Já está na hora da manutenção do seu ${b}. Agende pelo link: ${c}`;
    default: return p[0] ?? '';
  }
}

export async function queueNotification(n: {
  kind: NotifKind; dedupeKey: string; phone: string; customerId?: string | null; bookingId?: string | null;
  params: string[]; scheduledFor?: Date; body?: string;
}) {
  const s = await getSettings();
  const body = n.body ?? previewBody(n.kind, n.params, s.studio.name);
  const { error } = await db().from('notifications').upsert({
    kind: n.kind, dedupe_key: n.dedupeKey, to_phone: n.phone, customer_id: n.customerId ?? null, booking_id: n.bookingId ?? null,
    template: s.whatsapp.templates[n.kind] ?? null, params: n.params, body, scheduled_for: (n.scheduledFor ?? new Date()).toISOString(),
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true }); // chave única: nunca duplica
  if (error) throw error;
}

/** Enfileira a confirmação de um agendamento (idempotente). */
export async function queueConfirmation(bookingId: string) {
  const s = await getSettings();
  if (!s.whatsapp.enabled || !s.whatsapp.confirmation) return;
  const { data: b } = await db().from('bookings').select('*, customers(*)').eq('id', bookingId).single();
  if (!b || !b.customers?.whatsapp_consent) return;
  await queueNotification({
    kind: 'confirmation', dedupeKey: `confirmation:${b.id}:${new Date(b.start_at).getTime()}`, phone: b.customers.phone_e164,
    customerId: b.customer_id, bookingId: b.id, params: [firstName(b.customers.name), fmtDateBR(b.start_at), fmtTimeBR(b.start_at), b.service_name],
  });
}

export const firstName = (n: string) => n.trim().split(/\s+/)[0];

/** Envio real pela WhatsApp Cloud API. Nunca simula: sem credenciais, falha de forma explícita. */
export async function sendNotification(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data: n } = await db().from('notifications').select('*').eq('id', id).single();
  if (!n) return { ok: false, error: 'não encontrada' };
  const s = await getSettings();
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const fail = async (error: string, final = true) => {
    await db().from('notifications').update({ status: final ? 'falhou' : 'pendente', error, attempts: n.attempts + 1 }).eq('id', id);
    return { ok: false, error };
  };
  if (!token || !phoneId) return fail('WhatsApp não configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).');
  const payload = n.kind === 'manual'
    ? { messaging_product: 'whatsapp', to: n.to_phone, type: 'text', text: { body: n.body } }
    : { messaging_product: 'whatsapp', to: n.to_phone, type: 'template', template: {
        name: n.template, language: { code: s.whatsapp.language || 'pt_BR' },
        components: [{ type: 'body', parameters: (n.params as string[]).map((t) => ({ type: 'text', text: t })) }] } };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return fail(j?.error?.message ?? `HTTP ${r.status}`, n.attempts + 1 >= 3);
    await db().from('notifications').update({ status: 'enviado', sent_at: new Date().toISOString(), attempts: n.attempts + 1, error: null, provider_message_id: j?.messages?.[0]?.id ?? null }).eq('id', id);
    return { ok: true };
  } catch (e) { return fail(String((e as Error).message), n.attempts + 1 >= 3); }
}
