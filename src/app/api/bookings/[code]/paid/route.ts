import { NextResponse, type NextRequest } from 'next/server';
import { audit, db, handle, HttpError } from '@/lib/server';

// A cliente AVISA que pagou o PIX. Isso NÃO confirma nada: a reserva fica "aguardando confirmação" (horário segurado)
// até a profissional conferir o dinheiro na conta e confirmar no painel.
export const POST = handle(async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  await db().rpc('expire_holds');
  const { data: b } = await db().from('bookings').select('id,status').eq('public_code', code.toUpperCase()).maybeSingle();
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  if (b.status === 'aguardando_confirmacao') return NextResponse.json({ ok: true });
  if (b.status !== 'aguardando_pagamento') throw new HttpError(409, 'Esta reserva não está aguardando pagamento.');
  const { data: p } = await db().from('payments').select('id').eq('booking_id', b.id).eq('provider', 'manual').eq('status', 'pendente').limit(1).maybeSingle();
  if (!p) throw new HttpError(409, 'Gere o PIX antes de avisar o pagamento.');
  await db().from('bookings').update({ status: 'aguardando_confirmacao', hold_expires_at: null, updated_at: new Date().toISOString() }).eq('id', b.id);
  await audit('cliente', 'informou_pagamento_pix', 'booking', b.id);
  return NextResponse.json({ ok: true });
});
