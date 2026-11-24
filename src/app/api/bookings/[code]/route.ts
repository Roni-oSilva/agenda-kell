import { NextResponse, type NextRequest } from 'next/server';
import { db, getSettings, handle, HttpError } from '@/lib/server';
import { syncMpPayment } from '@/lib/mp';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  await db().rpc('expire_holds');
  let { data: b } = await db().from('bookings').select('*, customers(name)').eq('public_code', code.toUpperCase()).maybeSingle();
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');

  if (b.status === 'aguardando_pagamento' && process.env.MP_ACCESS_TOKEN) { // consulta de status no provedor
    const { data: pend } = await db().from('payments').select('provider_payment_id').eq('booking_id', b.id).eq('status', 'pendente').not('provider_payment_id', 'is', null);
    for (const p of pend ?? []) { try { await syncMpPayment(p.provider_payment_id!); } catch { /* tenta de novo no próximo poll */ } }
    b = (await db().from('bookings').select('*, customers(name)').eq('id', b.id).single()).data!;
  }
  const { data: pays } = await db().from('payments').select('id,provider,method,kind,status,amount_cents,pix_qr_code,pix_qr_base64,expires_at,paid_at').eq('booking_id', b.id).order('created_at', { ascending: false });
  const s = await getSettings();
  return NextResponse.json({
    code: b.public_code, name: b.customers?.name, service_name: b.service_name, start_at: b.start_at, end_at: b.end_at, status: b.status,
    total_cents: b.total_cents, deposit_cents: b.deposit_cents, paid_cents: b.paid_cents, balance_cents: Math.max(0, b.total_cents - b.paid_cents),
    hold_expires_at: b.hold_expires_at, cancel_reason: b.cancel_reason, policy: s.policy.text, contact: s.studio.whatsapp_contact,
    payments: (pays ?? []).map((p) => ({ ...p, pix_qr_code: p.status === 'pendente' ? p.pix_qr_code : null, pix_qr_base64: p.status === 'pendente' ? p.pix_qr_base64 : null })),
  });
});
