import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, getSettings, handle, HttpError } from '@/lib/server';
import { createCardCheckout } from '@/lib/mp';

const Body = z.object({ payFull: z.boolean().default(false) });

// Cartão via Checkout Pro do Mercado Pago: nenhum dado de cartão passa pelo nosso servidor. Pode ser chamado de novo após recusa.
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = Body.parse(await req.json().catch(() => ({})));
  const s = await getSettings();
  if (!s.payment_methods.card) throw new HttpError(400, 'Cartão indisponível.');
  await db().rpc('expire_holds');
  const { data: b } = await db().from('bookings').select('*').eq('public_code', code.toUpperCase()).maybeSingle();
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  if (b.status !== 'aguardando_pagamento') throw new HttpError(409, 'Reserva expirada ou já paga.');
  const amount = body.payFull ? b.total_cents : b.deposit_cents;
  const { url } = await createCardCheckout({ bookingId: b.id, code: b.public_code, amountCents: amount, title: `${b.service_name} (${body.payFull ? 'valor integral' : 'sinal'})`, maxInstallments: s.booking.max_installments });
  await db().from('bookings').update({ hold_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() }).eq('id', b.id);
  return NextResponse.json({ url });
});
