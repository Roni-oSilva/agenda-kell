import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { audit, db, handle, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';

const Svc = z.object({
  name: z.string().trim().min(2).max(120), category: z.string().trim().min(1).max(40).default('Outros'), description: z.string().max(1000).nullish(), image_url: z.string().url().nullish().or(z.literal('')),
  price_cents: z.number().int().min(0), duration_min: z.number().int().min(5).max(720), active: z.boolean().default(true),
  deposit_mode: z.enum(['none', 'fixed', 'percent', 'full']).default('none'), deposit_value: z.number().int().min(0).default(0),
  deposit_required: z.boolean().default(false), return_days: z.number().int().min(1).max(365).nullish(), sort_order: z.number().int().default(0),
}).refine((v) => v.deposit_mode !== 'percent' || v.deposit_value <= 100, 'Percentual máximo é 100');

export const GET = handle(async () => {
  await requireAdmin();
  const { data } = await db().from('services').select('*').order('sort_order').order('name');
  return NextResponse.json({ services: data });
});
export const POST = handle(async (req: NextRequest) => {
  const u = await requireAdmin();
  const body = Svc.parse(await req.json());
  const { data, error } = await db().from('services').insert({ ...body, image_url: body.image_url || null }).select('*').single();
  if (error) throw error;
  await audit(u.email ?? u.id, 'criar_servico', 'service', data.id);
  return NextResponse.json({ service: data }, { status: 201 });
});
export const PATCH = handle(async (req: NextRequest) => {
  const u = await requireAdmin();
  const { id, ...rest } = await req.json();
  const body = Svc.parse(rest);
  // O preço novo vale só para agendamentos futuros: bookings guardam cópia (snapshot) do preço/nome.
  const { data, error } = await db().from('services').update({ ...body, image_url: body.image_url || null }).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(u.email ?? u.id, 'editar_servico', 'service', id, body);
  return NextResponse.json({ service: data });
});
export const DELETE = handle(async (req: NextRequest) => {
  const u = await requireAdmin();
  const id = req.nextUrl.searchParams.get('id')!;
  const { error } = await db().from('services').delete().eq('id', id);
  if (error) throw error;
  await audit(u.email ?? u.id, 'excluir_servico', 'service', id);
  return NextResponse.json({ ok: true });
});
