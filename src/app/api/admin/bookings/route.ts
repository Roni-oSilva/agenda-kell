import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, handle, requireAdmin } from '@/lib/server';
import { createBooking } from '@/lib/booking';
import { toInstant, addDays } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  await db().rpc('expire_holds');
  const q = req.nextUrl.searchParams;
  const from = q.get('from'), to = q.get('to'), status = q.get('status'), cust = q.get('customer');
  let query = db().from('bookings').select('*, customers(id,name,phone_e164)').order('start_at').limit(1000);
  if (from) query = query.gte('start_at', toInstant(from, '00:00').toISOString());
  if (to) query = query.lt('start_at', toInstant(addDays(to, 1), '00:00').toISOString());
  if (status) query = query.eq('status', status);
  if (cust) query = query.eq('customer_id', cust);
  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ bookings: data });
});

const Body = z.object({
  serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2), phone: z.string().min(10), notes: z.string().max(500).optional(),
});
// Atendimento manual: ignora antecedência/horário, mas o banco ainda impede sobreposição.
export const POST = handle(async (req: NextRequest) => {
  await requireAdmin();
  const b = Body.parse(await req.json());
  const { booking } = await createBooking({ ...b, consent: false, policyAccepted: true, actor: 'admin' });
  return NextResponse.json({ booking }, { status: 201 });
});
