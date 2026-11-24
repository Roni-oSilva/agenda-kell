import { NextResponse, type NextRequest } from 'next/server';
import { audit, db, handle, HttpError, requireAdmin } from '@/lib/server';
import { queueConfirmation } from '@/lib/notify';

// A profissional confirma que o sinal caiu na conta dela: aprova o pagamento, confirma a reserva e enfileira a mensagem.
export const POST = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const { data: b } = await db().from('bookings').select('*').eq('id', id).single();
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  if (!['aguardando_pagamento', 'aguardando_confirmacao'].includes(b.status)) throw new HttpError(409, 'Esta reserva não está aguardando confirmação.');

  let { data: p } = await db().from('payments').select('*').eq('booking_id', id).eq('provider', 'manual').eq('status', 'pendente').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!p) { // a cliente pagou sem gerar o código aqui: registra o sinal combinado
    if (b.deposit_cents <= 0) throw new HttpError(400, 'Esta reserva não tem sinal a confirmar.');
    const ins = await db().from('payments').insert({ booking_id: id, provider: 'manual', method: 'pix', kind: 'sinal', amount_cents: b.deposit_cents, status: 'pendente' }).select('*').single();
    if (ins.error) throw ins.error;
    p = ins.data;
  }
  const { error } = await db().from('payments').update({ status: 'aprovado', paid_at: new Date().toISOString(), method: 'pix' }).eq('id', p!.id);
  if (error) throw error;
  const { error: e2 } = await db().rpc('apply_approved_payment', { p_payment_id: p!.id }); // soma o pago e confirma a reserva
  if (e2) throw e2;
  await queueConfirmation(id);
  await audit(u.email ?? u.id, 'confirmar_pagamento_pix', 'booking', id, { valor_cents: p!.amount_cents });
  return NextResponse.json({ ok: true });
});
