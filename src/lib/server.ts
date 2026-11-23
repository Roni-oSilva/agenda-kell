import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { computeDay, type AvailabilityConfig, type Busy } from './availability';
import { addDays, todayBR, toInstant } from './time';

let _db: SupabaseClient | null = null;
/** Cliente com service_role: SOMENTE no servidor. */
export function db(): SupabaseClient {
  if (!_db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new HttpError(503, 'Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    _db = createClient(url, key, { auth: { persistSession: false } });
  }
  return _db;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try { return await fn(...a); } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e && typeof e === 'object' && 'issues' in e) return NextResponse.json({ error: 'Dados inválidos', issues: (e as { issues: unknown }).issues }, { status: 400 });
      console.error('[api-error]', e);
      try { await db().from('audit_log').insert({ actor: 'sistema', action: 'erro', data: { message: String((e as Error)?.message ?? e) } }); } catch { /* ignore */ }
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
  };
}

export async function requireAdmin() {
  const store = await cookies();
  const supa = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: () => { /* leitura apenas */ } },
  });
  const { data } = await supa.auth.getUser();
  if (!data.user) throw new HttpError(401, 'Não autenticado');
  const { data: adm } = await db().from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!adm) throw new HttpError(403, 'Sem permissão');
  return data.user;
}

export async function audit(actor: string, action: string, entity: string, entityId: string, data?: unknown) {
  await db().from('audit_log').insert({ actor, action, entity, entity_id: entityId, data: data ?? null });
}

// ---------- configurações ----------
export type Settings = {
  studio: { name: string; whatsapp_contact: string };
  booking: { slot_step_min: number; min_notice_hours: number; max_days_ahead: number; hold_minutes: number; pix_expiration_minutes: number; max_installments: number };
  payment_methods: { pix: boolean; card: boolean; cash: boolean };
  policy: { text: string };
  whatsapp: { enabled: boolean; confirmation: boolean; reminder_24h: boolean; reminder_2h: boolean; waitlist: boolean; followup: boolean; language: string; templates: Record<string, string> };
};
const DEFAULTS = {
  studio: { name: 'Nail Designer', whatsapp_contact: '' },
  booking: { slot_step_min: 30, min_notice_hours: 2, max_days_ahead: 60, hold_minutes: 15, pix_expiration_minutes: 30, max_installments: 3 },
  payment_methods: { pix: true, card: true, cash: true },
  policy: { text: 'O sinal garante a reserva do horário. Em caso de cancelamento pela cliente, o sinal não é devolvido. Se o cancelamento for feito pela profissional, entraremos em contato para resolver a situação.' },
  whatsapp: { enabled: true, confirmation: true, reminder_24h: true, reminder_2h: false, waitlist: true, followup: true, language: 'pt_BR', templates: { confirmation: 'confirmacao_agendamento', reminder_24h: 'lembrete_24h', reminder_2h: 'lembrete_2h', waitlist: 'vaga_disponivel', followup: 'retorno_manutencao' } },
};
export async function getSettings(): Promise<Settings> {
  const { data } = await db().from('settings').select('key,value');
  const o: Record<string, unknown> = {};
  for (const r of data ?? []) o[r.key] = r.value;
  // completa com padrões (bancos criados antes destas configurações continuam funcionando)
  const merged = { ...o } as Record<string, unknown>;
  for (const [k, v] of Object.entries(DEFAULTS)) merged[k] = { ...v, ...((o[k] as object) ?? {}) };
  return merged as unknown as Settings;
}

export const BLOCKING = ['aguardando_pagamento', 'aguardando_confirmacao', 'confirmado', 'em_atendimento', 'concluido'];

export async function loadAvailability(s?: Settings) {
  const st = s ?? (await getSettings());
  const [wh, br, bl] = await Promise.all([
    db().from('weekly_hours').select('*'), db().from('breaks').select('*'), db().from('blocks').select('*'),
  ]);
  const cfg: AvailabilityConfig = {
    weeklyHours: wh.data ?? [], breaks: br.data ?? [], blocks: bl.data ?? [],
    stepMin: st.booking.slot_step_min, minNoticeHours: st.booking.min_notice_hours, maxDaysAhead: st.booking.max_days_ahead,
  };
  return cfg;
}

/** Reservas que ocupam agenda entre duas datas (ignora reservas temporárias vencidas). */
export async function loadBusy(fromDate: string, toDate: string): Promise<Busy[]> {
  const nowIso = new Date().toISOString();
  const { data } = await db().from('bookings').select('start_at,end_at,status,hold_expires_at')
    .in('status', BLOCKING).lt('start_at', toInstant(addDays(toDate, 1), '00:00').toISOString()).gt('end_at', toInstant(fromDate, '00:00').toISOString());
  return (data ?? [])
    .filter((b) => !(b.status === 'aguardando_pagamento' && b.hold_expires_at && b.hold_expires_at < nowIso))
    .map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) }));
}

export async function slotsFor(date: string, durationMin: number) {
  const cfg = await loadAvailability();
  const busy = await loadBusy(date, date);
  return computeDay(date, durationMin, cfg, busy);
}

export { todayBR };
