import { NextResponse, type NextRequest } from 'next/server';
import { db, handle } from '@/lib/server';
import { syncMpPayment, verifySignature } from '@/lib/mp';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: NextRequest) => {
  const raw = await req.text();
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try { body = JSON.parse(raw); } catch { /* usa query */ }
  const dataId = String(req.nextUrl.searchParams.get('data.id') ?? body.data?.id ?? '');
  if (!dataId) return NextResponse.json({ ok: true });

  // 1) autenticação do webhook (HMAC x-signature). Sem assinatura válida: rejeita.
  if (!verifySignature({ signature: req.headers.get('x-signature'), requestId: req.headers.get('x-request-id'), dataId })) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  }
  const type = body.type ?? req.nextUrl.searchParams.get('type');
  if (type && type !== 'payment') return NextResponse.json({ ok: true });

  // 2) idempotência por evento (reentregas não duplicam efeitos; a sincronização em si também é idempotente)
  const key = `${dataId}:${req.headers.get('x-request-id') ?? ''}`;
  await db().from('payment_events').upsert({ event_key: key, payload: body }, { onConflict: 'event_key', ignoreDuplicates: true });

  // 3) NUNCA confia no corpo: consulta o pagamento no Mercado Pago
  await syncMpPayment(dataId);
  return NextResponse.json({ ok: true });
});
