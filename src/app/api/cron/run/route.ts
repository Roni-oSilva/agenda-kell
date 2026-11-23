import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { db, getSettings, handle, loadAvailability, loadBusy } from '@/lib/server';
import { computeDay } from '@/lib/availability';
import { fmtDateBR, fmtTimeBR, todayBR } from '@/lib/time';
import { firstName, queueNotification, sendNotification } from '@/lib/notify';
import { syncMpPayment } from '@/lib/mp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PERIOD: Record<string, [string, string]> = { manha: ['00:00', '11:59'], tarde: ['12:00', '17:59'], noite: ['18:00', '23:59'] };
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

async function job(name: string, fn: () => Promise<unknown>) {
  const { data: run } = await db().from('automation_runs').insert({ job: name }).select('id').single();
  try {
    const detail = await fn();
    await db().from('automation_runs').update({ finished_at: new Date().toISOString(), ok: true, detail: detail as object }).eq('id', run!.id);
    return { job: name, ok: true, detail };
  } catch (e) {
    await db().from('automation_runs').update({ finished_at: new Date().toISOString(), ok: false, error: String((e as Error).message) }).eq('id', run!.id);
    return { job: name, ok: false, error: String((e as Error).message) };
  }
}

export const GET = handle(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 503 });
  const got = Buffer.from(req.headers.get('authorization') ?? ''), want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });

  const s = await getSettings();
  const now = new Date();
  const results = [];

  results.push(await job('expirar_reservas', async () => (await db().rpc('expire_holds')).data));

  results.push(await job('conferir_pagamentos_pendentes', async () => {
    if (!process.env.MP_ACCESS_TOKEN) return { skipped: 'MP_ACCESS_TOKEN ausente' };
    const { data } = await db().from('payments').select('provider_payment_id').eq('status', 'pendente').eq('provider', 'mercadopago').not('provider_payment_id', 'is', null).limit(50);
    let n = 0; for (const p of data ?? []) { await syncMpPayment(p.provider_payment_id!); n++; }
    return { conferidos: n };
  }));

  const reminders = async (kind: 'reminder_24h' | 'reminder_2h', hoursAhead: number, minGapHours: number) => {
    if (!s.whatsapp.enabled || !s.whatsapp[kind]) return { skipped: 'desativado' };
    const { data } = await db().from('bookings').select('*, customers(*)').eq('status', 'confirmado')
      .gt('start_at', now.toISOString()).lte('start_at', new Date(now.getTime() + hoursAhead * 3600_000).toISOString());
    let q = 0;
    for (const b of data ?? []) {
      // só lembra se o agendamento foi feito com antecedência maior que o lembrete (senão a confirmação já serve)
      if ((new Date(b.start_at).getTime() - new Date(b.created_at).getTime()) / 3600_000 < minGapHours) continue;
      if (!b.customers?.whatsapp_consent) continue;
      await queueNotification({ kind, dedupeKey: `${kind}:${b.id}:${new Date(b.start_at).getTime()}`, phone: b.customers.phone_e164, customerId: b.customer_id, bookingId: b.id, params: [firstName(b.customers.name), fmtDateBR(b.start_at), fmtTimeBR(b.start_at), b.service_name] });
      q++;
    }
    return { avaliados: data?.length ?? 0 };
  };
  results.push(await job('lembretes_24h', () => reminders('reminder_24h', 25, 25)));
  results.push(await job('lembretes_2h', () => reminders('reminder_2h', 2.25, 3)));

  results.push(await job('lista_de_espera', async () => {
    if (!s.whatsapp.enabled || !s.whatsapp.waitlist) return { skipped: 'desativado' };
    const { data: list } = await db().from('waitlist').select('*, services(name,duration_min,active)').eq('status', 'aguardando').eq('whatsapp_consent', true);
    if (!list?.length) return { notificadas: 0 };
    const cfg = await loadAvailability(s), today = todayBR(now);
    const dates = list.flatMap((w) => w.preferred_dates as string[]).filter((d) => d >= today).sort();
    if (!dates.length) return { notificadas: 0 };
    const busy = await loadBusy(dates[0], dates[dates.length - 1]);
    let n = 0;
    for (const w of list) {
      const svc = w.services as { name: string; duration_min: number; active: boolean } | null;
      if (!svc?.active) continue;
      let found: { date: string; time: string } | null = null;
      for (const d of (w.preferred_dates as string[]).filter((x) => x >= today).sort()) {
        const { slots } = computeDay(d, svc.duration_min, cfg, busy, now);
        const t = slots.find((hm) => (w.periods as string[]).some((p) => hm >= PERIOD[p][0] && hm <= PERIOD[p][1]));
        if (t) { found = { date: d, time: t }; break; }
      }
      if (!found) continue;
      // apenas AVISA com link: a cliente precisa confirmar a reserva por conta própria (sem reserva automática)
      await queueNotification({ kind: 'waitlist', dedupeKey: `waitlist:${w.id}:${found.date}`, phone: w.phone_e164, params: [firstName(w.name), svc.name, found.date.split('-').reverse().join('/'), found.time, `${site()}/agendar?servico=${w.service_id}&data=${found.date}`] });
      await db().from('waitlist').update({ status: 'notificada', notified_for: `${found.date}T${found.time}:00-03:00` }).eq('id', w.id);
      n++;
    }
    return { notificadas: n };
  }));

  results.push(await job('retornos_manutencao', async () => {
    if (!s.whatsapp.enabled || !s.whatsapp.followup) return { skipped: 'desativado' };
    const { data } = await db().from('followups').select('*, customers(*), bookings(service_name,service_id)').eq('status', 'pendente').lte('due_date', todayBR(now));
    let n = 0;
    for (const f of data ?? []) {
      if (!f.customers?.whatsapp_consent) continue;
      const b = f.bookings as { service_name: string; service_id: string | null };
      await queueNotification({ kind: 'followup', dedupeKey: `followup:${f.id}`, phone: f.customers.phone_e164, customerId: f.customer_id, bookingId: f.booking_id, params: [firstName(f.customers.name), b.service_name, `${site()}/agendar${b.service_id ? `?servico=${b.service_id}` : ''}`] });
      await db().from('followups').update({ status: 'enviado' }).eq('id', f.id);
      n++;
    }
    return { enfileirados: n };
  }));

  results.push(await job('enviar_mensagens', async () => {
    const { data } = await db().from('notifications').select('id').eq('status', 'pendente').lte('scheduled_for', now.toISOString()).lt('attempts', 3).order('scheduled_for').limit(40);
    let ok = 0, fail = 0;
    for (const n of data ?? []) { const r = await sendNotification(n.id); r.ok ? ok++ : fail++; }
    return { enviadas: ok, falhas: fail };
  }));

  return NextResponse.json({ ran_at: now.toISOString(), results });
});
