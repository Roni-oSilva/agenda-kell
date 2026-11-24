import { NextResponse } from 'next/server';
import { db, handle, requireAdmin } from '@/lib/server';
import { addDays, toInstant, todayBR } from '@/lib/time';

export const dynamic = 'force-dynamic';

type Pay = { id: string; status: string; kind: string; amount_cents: number; method: string; provider: string };

/** Resumo para a tela Início: o que precisa de ação (PIX para conferir, pedidos para aceitar) + números do dia. */
export const GET = handle(async () => {
  await requireAdmin();
  await db().rpc('expire_holds');
  const today = todayBR();
  const dayStart = toInstant(today, '00:00').toISOString(), dayEnd = toInstant(addDays(today, 1), '00:00').toISOString();
  const weekEnd = toInstant(addDays(today, 8), '00:00').toISOString(), monthStart = toInstant(`${today.slice(0, 7)}-01`, '00:00').toISOString();
  const sel = '*, customers(id,name,phone_e164), payments(id,status,kind,amount_cents,method,provider)';

  const [pend, todays, week, paid, future] = await Promise.all([
    db().from('bookings').select(sel).in('status', ['aguardando_pagamento', 'aguardando_confirmacao']).gte('start_at', new Date(Date.now() - 86400_000).toISOString()).order('created_at', { ascending: true }).limit(200),
    db().from('bookings').select(sel).gte('start_at', dayStart).lt('start_at', dayEnd).not('status', 'in', '(cancelado,nao_compareceu)').order('start_at'),
    db().from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmado').gte('start_at', dayStart).lt('start_at', weekEnd),
    db().from('payments').select('amount_cents').eq('status', 'aprovado').gte('paid_at', monthStart),
    db().from('bookings').select('total_cents,paid_cents').in('status', ['confirmado', 'em_atendimento']).gte('start_at', dayStart),
  ]);

  const toConfirm: unknown[] = [], waitingPix: unknown[] = [], toAccept: unknown[] = [];
  for (const b of pend.data ?? []) {
    const pays = (b.payments ?? []) as Pay[];
    const pix = pays.find((p) => p.provider === 'manual' && p.status === 'pendente');
    if (b.status === 'aguardando_confirmacao' && pix) toConfirm.push({ ...b, pix_amount_cents: pix.amount_cents });
    else if (b.status === 'aguardando_pagamento') waitingPix.push({ ...b, pix_amount_cents: pix?.amount_cents ?? b.deposit_cents });
    else toAccept.push(b);
  }
  return NextResponse.json({
    toConfirm, waitingPix, toAccept, today: todays.data ?? [],
    weekCount: week.count ?? 0,
    monthReceivedCents: (paid.data ?? []).reduce((a, p) => a + p.amount_cents, 0),
    receivableCents: (future.data ?? []).reduce((a, b) => a + Math.max(0, b.total_cents - b.paid_cents), 0),
  });
});
