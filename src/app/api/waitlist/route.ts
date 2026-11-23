import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, handle, HttpError } from '@/lib/server';
import { normalizePhone } from '@/lib/time';

const Body = z.object({
  name: z.string().trim().min(3).max(120), phone: z.string().min(10).max(20), serviceId: z.string().uuid(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(15),
  periods: z.array(z.enum(['manha', 'tarde', 'noite'])).min(1), consent: z.literal(true),
});

export const POST = handle(async (req: NextRequest) => {
  const b = Body.parse(await req.json());
  const phone = normalizePhone(b.phone);
  if (!phone) throw new HttpError(400, 'WhatsApp inválido.');
  const { error } = await db().from('waitlist').insert({ name: b.name, phone_e164: phone, service_id: b.serviceId, preferred_dates: b.dates, periods: b.periods, whatsapp_consent: true });
  if (error) throw error;
  return NextResponse.json({ ok: true }, { status: 201 });
});
