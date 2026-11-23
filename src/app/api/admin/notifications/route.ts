import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, handle, HttpError, requireAdmin } from '@/lib/server';
import { sendNotification } from '@/lib/notify';
import { normalizePhone } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const [n, r] = await Promise.all([
    db().from('notifications').select('id,kind,to_phone,body,status,attempts,error,scheduled_for,sent_at,created_at,customers(name)').order('created_at', { ascending: false }).limit(200),
    db().from('automation_runs').select('*').order('id', { ascending: false }).limit(40),
  ]);
  return NextResponse.json({ notifications: n.data, runs: r.data });
});

const Body = z.union([
  z.object({ resend: z.string().uuid() }),
  z.object({ phone: z.string().min(10), message: z.string().min(1).max(1000) }),
]);

export const POST = handle(async (req: NextRequest) => {
  await requireAdmin();
  const b = Body.parse(await req.json());
  if ('resend' in b) {
    await db().from('notifications').update({ status: 'pendente', attempts: 0, error: null }).eq('id', b.resend);
    return NextResponse.json(await sendNotification(b.resend)); // reenvio manual (resultado real, nunca simulado)
  }
  const phone = normalizePhone(b.phone);
  if (!phone) throw new HttpError(400, 'Telefone inválido');
  // mensagem livre só é entregue dentro da janela de 24h do WhatsApp; fora dela a API devolve erro, que fica registrado
  const { data } = await db().from('notifications').insert({ kind: 'manual', dedupe_key: `manual:${crypto.randomUUID()}`, to_phone: phone, body: b.message }).select('id').single();
  return NextResponse.json(await sendNotification(data!.id));
});
