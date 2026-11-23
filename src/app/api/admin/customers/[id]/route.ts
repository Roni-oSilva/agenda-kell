import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { audit, db, handle, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_r: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const [c, p, b] = await Promise.all([
    db().from('customers').select('*').eq('id', id).single(), db().from('customer_profiles').select('*').eq('customer_id', id).maybeSingle(),
    db().from('bookings').select('id,service_name,start_at,status,total_cents,paid_cents').eq('customer_id', id).order('start_at', { ascending: false }),
  ]);
  return NextResponse.json({ customer: c.data, profile: p.data, bookings: b.data });
});

const Profile = z.object({ nail_preferences: z.string().max(1000).nullish(), shape: z.string().max(200).nullish(), length: z.string().max(200).nullish(), decoration: z.string().max(1000).nullish(), allergies: z.string().max(1000).nullish(), notes: z.string().max(2000).nullish() });

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const body = Profile.parse(await req.json());
  const { error } = await db().from('customer_profiles').upsert({ customer_id: id, ...body, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit(u.email ?? u.id, 'editar_ficha', 'customer', id);
  return NextResponse.json({ ok: true });
});
