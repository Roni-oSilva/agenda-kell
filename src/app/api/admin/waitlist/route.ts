import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, handle, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const { data } = await db().from('waitlist').select('*, services(name)').order('created_at', { ascending: false }).limit(300);
  return NextResponse.json({ waitlist: data });
});
export const PATCH = handle(async (req: NextRequest) => {
  await requireAdmin();
  const b = z.object({ id: z.string().uuid(), status: z.enum(['aguardando', 'notificada', 'atendida', 'cancelada']) }).parse(await req.json());
  await db().from('waitlist').update({ status: b.status }).eq('id', b.id);
  return NextResponse.json({ ok: true });
});
