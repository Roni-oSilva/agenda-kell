import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { audit, db, getSettings, handle, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';

const Schemas = {
  studio: z.object({ name: z.string().min(1).max(80), whatsapp_contact: z.string().max(30) }),
  booking: z.object({ slot_step_min: z.number().int().min(5).max(120), min_notice_hours: z.number().min(0).max(720), max_days_ahead: z.number().int().min(1).max(365), hold_minutes: z.number().int().min(5).max(120), pix_expiration_minutes: z.number().int().min(30).max(1440), max_installments: z.number().int().min(1).max(12), auto_accept: z.boolean().default(false) }),
  payment_methods: z.object({ pix: z.boolean(), card: z.boolean(), cash: z.boolean() }),
  pix_manual: z.object({ enabled: z.boolean(), key: z.string().trim().max(80), key_type: z.enum(['cpf', 'cnpj', 'phone', 'email', 'random']), holder: z.string().trim().max(60), city: z.string().trim().max(40) }),
  policy: z.object({ text: z.string().min(10).max(3000) }),
  whatsapp: z.object({ enabled: z.boolean(), confirmation: z.boolean(), reminder_24h: z.boolean(), reminder_2h: z.boolean(), waitlist: z.boolean(), followup: z.boolean(), language: z.string().max(10), templates: z.record(z.string().max(100)) }),
};

export const GET = handle(async () => {
  await requireAdmin();
  return NextResponse.json({
    settings: await getSettings(),
    integrations: { // só informa se existe, nunca expõe valores
      supabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY, mercadopago: !!process.env.MP_ACCESS_TOKEN, mp_webhook_secret: !!process.env.MP_WEBHOOK_SECRET,
      whatsapp: !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID, cron_secret: !!process.env.CRON_SECRET,
    },
  });
});

export const PUT = handle(async (req: NextRequest) => {
  const u = await requireAdmin();
  const { key, value } = z.object({ key: z.enum(['studio', 'pix_manual', 'booking', 'payment_methods', 'policy', 'whatsapp']), value: z.unknown() }).parse(await req.json());
  const v = Schemas[key].parse(value);
  await db().from('settings').upsert({ key, value: v, updated_at: new Date().toISOString() });
  await audit(u.email ?? u.id, 'config', 'settings', key);
  return NextResponse.json({ ok: true });
});
