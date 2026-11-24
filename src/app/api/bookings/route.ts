import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/server';
import { createBooking } from '@/lib/booking';
import { isValidCpf } from '@/lib/cpf';

export const dynamic = 'force-dynamic';

const Body = z.object({
  serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(3).max(120), phone: z.string().min(10).max(20),
  cpf: z.string().refine(isValidCpf, 'CPF inválido'), email: z.string().trim().email('E-mail inválido').max(120),
  notes: z.string().trim().max(300).optional(),
  consent: z.boolean(), policyAccepted: z.boolean(), website: z.string().max(0).optional(), // honeypot anti-robô
});

export const POST = handle(async (req: NextRequest) => {
  const b = Body.parse(await req.json());
  const { booking, needsPayment } = await createBooking({ ...b, actor: 'cliente' });
  return NextResponse.json({ code: booking.public_code, status: booking.status, needsPayment }, { status: 201 });
});
