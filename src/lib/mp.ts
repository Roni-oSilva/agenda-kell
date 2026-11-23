import 'server-only';
import crypto from 'node:crypto';
import { db, HttpError } from './server';
import { queueConfirmation } from './notify';

const API = 'https://api.mercadopago.com';
function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new HttpError(503, 'Mercado Pago não configurado (MP_ACCESS_TOKEN).');
  return t;
}
async function mp(path: string, init: RequestInit & { idem?: string } = {}) {
  const r = await fetch(API + path, {
    ...init, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(init.idem ? { 'X-Idempotency-Key': init.idem } : {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `Mercado Pago: ${j?.message ?? r.status}`);
  return j;
}
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const brIso = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().replace('Z', '-03:00');

export async function createPix(a: { bookingId: string; code: string; amountCents: number; description: string; payerName: string; payerEmail?: string; expiresInMin: number }) {
  const email = a.payerEmail || process.env.MP_FALLBACK_PAYER_EMAIL;
  if (!email) throw new HttpError(503, 'Informe um e-mail (ou configure MP_FALLBACK_PAYER_EMAIL) — o Mercado Pago exige e-mail do pagador no PIX.');
  const expires = new Date(Date.now() + a.expiresInMin * 60_000);
  const j = await mp('/v1/payments', {
    method: 'POST', idem: crypto.randomUUID(),
    body: JSON.stringify({
      transaction_amount: a.amountCents / 100, description: a.description, payment_method_id: 'pix',
      payer: { email, first_name: a.payerName.split(' ')[0] }, external_reference: a.bookingId,
      notification_url: `${siteUrl()}/api/webhooks/mercadopago`, date_of_expiration: brIso(expires),
    }),
  });
  return { id: String(j.id), qr: j.point_of_interaction?.transaction_data?.qr_code as string, qrBase64: j.point_of_interaction?.transaction_data?.qr_code_base64 as string, expires };
}

/** Checkout Pro (página do Mercado Pago): cartão de crédito/débito e parcelamento sem dados de cartão no nosso servidor. */
export async function createCardCheckout(a: { bookingId: string; code: string; amountCents: number; title: string; maxInstallments: number }) {
  const back = `${siteUrl()}/agendamento/${a.code}`;
  const j = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ title: a.title, quantity: 1, unit_price: a.amountCents / 100, currency_id: 'BRL' }],
      external_reference: a.bookingId, notification_url: `${siteUrl()}/api/webhooks/mercadopago`,
      back_urls: { success: back, failure: back, pending: back }, auto_return: 'approved',
      payment_methods: { installments: a.maxInstallments, excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }] },
    }),
  });
  return { url: j.init_point as string };
}

export async function getPayment(id: string) { return mp(`/v1/payments/${encodeURIComponent(id)}`); }

export function verifySignature(a: { signature: string | null; requestId: string | null; dataId: string }): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !a.signature) return false;
  const parts = Object.fromEntries(a.signature.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(a.dataId) ? a.dataId.toLowerCase() : a.dataId;
  const manifest = `id:${id};request-id:${a.requestId ?? ''};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const x = Buffer.from(expected), y = Buffer.from(parts.v1);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const STATUS: Record<string, string> = { approved: 'aprovado', authorized: 'pendente', pending: 'pendente', in_process: 'pendente', in_mediation: 'pendente', rejected: 'recusado', cancelled: 'cancelado', refunded: 'cancelado', charged_back: 'cancelado' };
const METHOD = (t: string) => (t === 'credit_card' ? 'credit_card' : t === 'debit_card' ? 'debit_card' : t === 'bank_transfer' || t === 'pix' ? 'pix' : 'other');

/**
 * Fonte da verdade: consulta o pagamento DIRETAMENTE no Mercado Pago (nunca confia no corpo do webhook
 * nem em comprovantes). Idempotente: pode ser chamada várias vezes para o mesmo pagamento.
 */
export async function syncMpPayment(mpId: string) {
  const p = await getPayment(mpId);
  const bookingId = p.external_reference as string | undefined;
  if (!bookingId) return { ignored: true };
  const { data: booking } = await db().from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) return { ignored: true };
  let status = STATUS[p.status] ?? 'pendente';
  if (p.status === 'pending' && p.date_of_expiration && new Date(p.date_of_expiration) < new Date() && METHOD(p.payment_type_id) === 'pix') status = 'expirado';
  const amount = Math.round(Number(p.transaction_amount) * 100);
  const row = {
    booking_id: bookingId, provider: 'mercadopago', provider_payment_id: String(p.id), method: METHOD(p.payment_type_id), amount_cents: amount,
    kind: amount >= booking.total_cents ? 'integral' : 'sinal', status, installments: p.installments ?? null,
    paid_at: status === 'aprovado' ? (p.date_approved ?? new Date().toISOString()) : null,
    pix_qr_code: p.point_of_interaction?.transaction_data?.qr_code ?? null, pix_qr_base64: p.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
    expires_at: p.date_of_expiration ?? null, raw: { status: p.status, status_detail: p.status_detail, payment_type_id: p.payment_type_id },
  };
  const { data: saved, error } = await db().from('payments').upsert(row, { onConflict: 'provider_payment_id' }).select('id').single();
  if (error) throw error;
  if (status !== 'aprovado') return { status };

  // pagamento aprovado
  if (booking.status === 'cancelado') {
    // a reserva temporária venceu antes do pagamento: tenta reativar se o horário ainda estiver livre
    const { error: e2 } = await db().from('bookings').update({ status: 'confirmado', cancel_reason: null, canceled_by: null, hold_expires_at: null }).eq('id', bookingId);
    if (e2) {
      await db().from('audit_log').insert({ actor: 'sistema', action: 'pagamento_sem_vaga', entity: 'booking', entity_id: bookingId, data: { payment: p.id, motivo: e2.message } });
      await db().rpc('apply_approved_payment', { p_payment_id: saved.id });
      return { status, conflict: true };
    }
  }
  await db().rpc('apply_approved_payment', { p_payment_id: saved.id });
  await queueConfirmation(bookingId);
  return { status };
}
