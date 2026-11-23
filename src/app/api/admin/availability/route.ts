import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, handle, HttpError, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';
const T = z.string().regex(/^\d{2}:\d{2}/);
const D = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('hours'), rows: z.array(z.object({ weekday: z.number().int().min(0).max(6), active: z.boolean(), open_time: T, close_time: T })) }),
  z.object({ action: z.literal('addBreak'), weekday: z.number().int().min(0).max(6).nullable(), start_time: T, end_time: T, label: z.string().max(60).optional() }),
  z.object({ action: z.literal('delBreak'), id: z.string().uuid() }),
  z.object({ action: z.literal('addBlock'), date_from: D, date_to: D, start_time: T.nullable(), end_time: T.nullable(), kind: z.enum(['folga', 'feriado', 'bloqueio']), reason: z.string().max(120).optional() }),
  z.object({ action: z.literal('delBlock'), id: z.string().uuid() }),
]);

export const GET = handle(async () => {
  await requireAdmin();
  const [h, b, k] = await Promise.all([db().from('weekly_hours').select('*').order('weekday'), db().from('breaks').select('*').order('start_time'), db().from('blocks').select('*').order('date_from')]);
  return NextResponse.json({ hours: h.data, breaks: b.data, blocks: k.data });
});

export const POST = handle(async (req: NextRequest) => {
  await requireAdmin();
  const a = Action.parse(await req.json());
  let error;
  switch (a.action) {
    case 'hours':
      for (const r of a.rows) if (r.close_time <= r.open_time) throw new HttpError(400, 'Fechamento deve ser depois da abertura.');
      ({ error } = await db().from('weekly_hours').upsert(a.rows)); break;
    case 'addBreak': ({ error } = await db().from('breaks').insert({ weekday: a.weekday, start_time: a.start_time, end_time: a.end_time, label: a.label })); break;
    case 'delBreak': ({ error } = await db().from('breaks').delete().eq('id', a.id)); break;
    case 'addBlock':
      if (a.date_to < a.date_from) throw new HttpError(400, 'Data final anterior à inicial.');
      if ((a.start_time === null) !== (a.end_time === null)) throw new HttpError(400, 'Informe início e fim do horário, ou nenhum para o dia inteiro.');
      ({ error } = await db().from('blocks').insert({ date_from: a.date_from, date_to: a.date_to, start_time: a.start_time, end_time: a.end_time, kind: a.kind, reason: a.reason })); break;
    case 'delBlock': ({ error } = await db().from('blocks').delete().eq('id', a.id)); break;
  }
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
