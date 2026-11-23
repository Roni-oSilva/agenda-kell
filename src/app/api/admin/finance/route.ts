import { NextResponse, type NextRequest } from 'next/server';
import { db, handle, requireAdmin } from '@/lib/server';
import { addDays, toInstant } from '@/lib/time';
import { summarize, type FBooking, type FPayment } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? addDays(new Date().toISOString().slice(0, 10), -30), to = q.get('to') ?? addDays(new Date().toISOString().slice(0, 10), 30);
  const lo = toInstant(from, '00:00').toISOString(), hi = toInstant(addDays(to, 1), '00:00').toISOString();
  const service = q.get('service'), method = q.get('method'), customer = q.get('customer');

  let bq = db().from('bookings').select('id,service_name,customer_id,status,total_cents,paid_cents,start_at').gte('start_at', lo).lt('start_at', hi).limit(5000);
  if (service) bq = bq.eq('service_name', service);
  if (customer) bq = bq.eq('customer_id', customer);
  const { data: bookings } = await bq;

  // recebimentos pela DATA DO PAGAMENTO (inclui sinais de atendimentos fora do período)
  const { data: pays } = await db().from('payments').select('booking_id,method,kind,amount_cents,paid_at, bookings!inner(service_name,customer_id)')
    .eq('status', 'aprovado').gte('paid_at', lo).lt('paid_at', hi).limit(5000);
  const payments = ((pays ?? []) as unknown as (FPayment & { bookings: { service_name: string; customer_id: string } })[])
    .filter((p) => (!method || p.method === method) && (!service || p.bookings.service_name === service) && (!customer || p.bookings.customer_id === customer));
  const bk = (bookings ?? []) as FBooking[];
  const known = new Set(bk.map((b) => b.id));
  for (const p of payments) if (!known.has(p.booking_id)) bk.push({ id: p.booking_id, service_name: p.bookings.service_name, customer_id: p.bookings.customer_id, status: 'fora_periodo', total_cents: 0, paid_cents: 0, start_at: p.paid_at });
  // 'fora_periodo' entra só para nomear o serviço no histórico; zerado, não afeta previsto/pendente
  return NextResponse.json(summarize(payments, bk));
});
