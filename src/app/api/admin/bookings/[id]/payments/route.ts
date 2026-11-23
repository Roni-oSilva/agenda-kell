import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { audit, db, handle, HttpError, requireAdmin } from '@/lib/server';

const Body = z.object({ method: z.enum(['pix', 'cash', 'credit_card', 'debit_card', 'other']), amount_cents: z.number().int().positive() });

export const GET = handle(async (_r: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const { data } = await db().from('payments').select('*').eq('booking_id', id).order('created_at');
  return NextResponse.json({ payments: data });
});

// Registra recebimento presencial (saldo restante). Pagamento online só é confirmado via webhook/consulta ao provedor.
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const { data: bk } = await db().from('bookings').select('*').eq('id', id).single();
  if (!bk) throw new HttpError(404, 'Agendamento não encontrado');
  const balance = bk.total_cents - bk.paid_cents;
  if (b.amount_cents > balance) throw new HttpError(400, 'Valor maior que o saldo restante.');
  const { error } = await db().from('payments').insert({
    booking_id: id, provider: 'manual', method: b.method, kind: bk.paid_cents === 0 && b.amount_cents >= bk.total_cents ? 'integral' : 'saldo',
    amount_cents: b.amount_cents, status: 'aprovado', paid_at: new Date().toISOString(),
  });
  if (error) throw error;
  const { data: sum } = await db().from('payments').select('amount_cents').eq('booking_id', id).eq('status', 'aprovado');
  const paid = (sum ?? []).reduce((a, p) => a + p.amount_cents, 0);
  await db().from('bookings').update({ paid_cents: paid, updated_at: new Date().toISOString() }).eq('id', id);
  await audit(u.email ?? u.id, 'registrar_pagamento', 'booking', id, b);
  return NextResponse.json({ paid_cents: paid, balance_cents: bk.total_cents - paid });
});
