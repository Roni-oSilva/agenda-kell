import { NextResponse, type NextRequest } from 'next/server';
import { db, handle, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  let query = db().from('customers').select('*').order('created_at', { ascending: false }).limit(200);
  if (q) { const digits = q.replace(/\D/g, ''); query = query.or(`name.ilike.%${q.replace(/[%,()]/g, '')}%${digits ? `,phone_e164.ilike.%${digits}%` : ''}`); }
  const { data: customers } = await query;
  const ids = (customers ?? []).map((c) => c.id);
  const { data: bks } = ids.length ? await db().from('bookings').select('customer_id,status,start_at,paid_cents').in('customer_id', ids) : { data: [] };
  const now = Date.now();
  const out = (customers ?? []).map((c) => {
    const mine = (bks ?? []).filter((b) => b.customer_id === c.id);
    const done = mine.filter((b) => b.status === 'concluido');
    const next = mine.filter((b) => ['confirmado', 'aguardando_confirmacao', 'aguardando_pagamento'].includes(b.status) && new Date(b.start_at).getTime() > now).sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
    return { ...c, visits: done.length, last_visit: done.map((b) => b.start_at).sort().pop() ?? null, next_booking: next?.start_at ?? null, total_spent_cents: mine.reduce((a, b) => a + b.paid_cents, 0) };
  });
  return NextResponse.json({ customers: out });
});
