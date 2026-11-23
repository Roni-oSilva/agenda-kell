import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, handle, HttpError } from '@/lib/server';
import { setStatus } from '@/lib/booking';

// Cancelamento pela cliente. NÃO existe reembolso/estorno no sistema: o sinal pago é mantido e o histórico financeiro preservado.
const Body = z.object({ phoneLast4: z.string().regex(/^\d{4}$/), reason: z.string().trim().min(3).max(300) });

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = Body.parse(await req.json());
  const { data: b } = await db().from('bookings').select('id,status,customers(phone_e164)').eq('public_code', code.toUpperCase()).maybeSingle();
  const phone = (b?.customers as unknown as { phone_e164: string } | null)?.phone_e164;
  if (!b || !phone || !phone.endsWith(body.phoneLast4)) throw new HttpError(404, 'Agendamento não encontrado');
  if (!['aguardando_pagamento', 'aguardando_confirmacao', 'confirmado'].includes(b.status)) throw new HttpError(409, 'Este agendamento não pode mais ser cancelado.');
  await setStatus(b.id, 'cancelado', { reason: body.reason, by: 'cliente' });
  return NextResponse.json({ ok: true });
});
