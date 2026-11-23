import { NextResponse, type NextRequest } from 'next/server';
import { db, handle, HttpError, loadAvailability, loadBusy } from '@/lib/server';
import { computeDay } from '@/lib/availability';
import { addDays } from '@/lib/time';

export const dynamic = 'force-dynamic';

// GET ?service=ID&month=YYYY-MM  -> status de cada dia | GET ?service=ID&date=YYYY-MM-DD -> horários livres
export const GET = handle(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const serviceId = q.get('service') ?? '';
  const { data: svc } = await db().from('services').select('duration_min,active').eq('id', serviceId).maybeSingle();
  if (!svc || !svc.active) throw new HttpError(404, 'Procedimento não encontrado');
  await db().rpc('expire_holds');
  const cfg = await loadAvailability();
  const month = q.get('month'), date = q.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(computeDay(date, svc.duration_min, cfg, await loadBusy(date, date)));
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const first = `${month}-01`;
    const days: Record<string, { status: string; count: number; taken: number }> = {};
    const last = addDays(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 1)).toISOString().slice(0, 10), -1);
    const busy = await loadBusy(first, last);
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const r = computeDay(d, svc.duration_min, cfg, busy);
      days[d] = { status: r.status, count: r.slots.length, taken: r.taken.length };
    }
    return NextResponse.json({ days });
  }
  throw new HttpError(400, 'Informe month ou date');
});
