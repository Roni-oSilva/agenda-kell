import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db, getSettings, handle, HttpError } from '@/lib/server';
import { createPix } from '@/lib/mp';
import { buildPixPayload } from '@/lib/pix';

const Body = z.object({ payFull: z.boolean().default(false), email: z.string().email().optional() });

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = Body.parse(await req.json().catch(() => ({})));
  const s = await getSettings();
  const useMp = !!process.env.MP_ACCESS_TOKEN;
  if (!s.payment_methods.pix) throw new HttpError(400, 'PIX indisponível.');
  await db().rpc('expire_holds');
  const { data: b } = await db().from('bookings').select('*, customers(name,cpf,email)').eq('public_code', code.toUpperCase()).maybeSingle();
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  if (b.status !== 'aguardando_pagamento') throw new HttpError(409, 'Reserva expirada ou já paga.');
  const amount = body.payFull ? b.total_cents : b.deposit_cents;
  if (amount <= 0) throw new HttpError(400, 'Nada a cobrar.');
  const kind = amount >= b.total_cents ? 'integral' : 'sinal';

  // ---------- PIX direto na chave da profissional (sem Mercado Pago) ----------
  if (!useMp) {
    const m = s.pix_manual;
    if (!m.enabled || !m.key) throw new HttpError(503, 'O PIX ainda não foi configurado pela profissional.');
    const expires = new Date(Date.now() + 30 * 60_000);
    const { data: open } = await db().from('payments').select('*').eq('booking_id', b.id).eq('provider', 'manual').eq('method', 'pix').eq('status', 'pendente').eq('amount_cents', amount).limit(1).maybeSingle();
    let payload = open?.pix_qr_code as string | undefined, qrBase64 = open?.pix_qr_base64 as string | undefined;
    if (!open) {
      payload = buildPixPayload({ key: m.key, keyType: m.key_type, holder: m.holder, city: m.city, amountCents: amount, txid: b.public_code });
      qrBase64 = (await QRCode.toDataURL(payload, { margin: 1, width: 360 })).split(',')[1];
      await db().from('payments').insert({ booking_id: b.id, provider: 'manual', method: 'pix', kind, amount_cents: amount, status: 'pendente', pix_qr_code: payload, pix_qr_base64: qrBase64, expires_at: expires.toISOString() });
    }
    await db().from('bookings').update({ hold_expires_at: expires.toISOString() }).eq('id', b.id); // segura o horário enquanto ela paga
    return NextResponse.json({ manual: true, qr: payload, qrBase64, expires_at: expires.toISOString(), amount_cents: amount, holder: m.holder });
  }

  // ---------- Mercado Pago ----------
  // reaproveita cobrança PIX ainda válida (evita cobranças duplicadas)
  const { data: open } = await db().from('payments').select('*').eq('booking_id', b.id).eq('method', 'pix').eq('status', 'pendente').eq('amount_cents', amount).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
  if (open) return NextResponse.json({ qr: open.pix_qr_code, qrBase64: open.pix_qr_base64, expires_at: open.expires_at, amount_cents: amount });

  const pix = await createPix({ bookingId: b.id, code: b.public_code, amountCents: amount, description: `${b.service_name} — ${b.public_code}`, payerName: b.customers?.name ?? 'Cliente', payerEmail: body.email ?? b.customers?.email, payerCpf: b.customers?.cpf, expiresInMin: Math.max(30, s.booking.pix_expiration_minutes) });
  await db().from('payments').insert({
    booking_id: b.id, provider: 'mercadopago', provider_payment_id: pix.id, method: 'pix', kind,
    amount_cents: amount, status: 'pendente', pix_qr_code: pix.qr, pix_qr_base64: pix.qrBase64, expires_at: pix.expires.toISOString(),
  });
  await db().from('bookings').update({ hold_expires_at: new Date(pix.expires.getTime() + 60_000).toISOString() }).eq('id', b.id);
  return NextResponse.json({ qr: pix.qr, qrBase64: pix.qrBase64, expires_at: pix.expires.toISOString(), amount_cents: amount });
});
