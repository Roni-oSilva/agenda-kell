import { NextResponse } from 'next/server';
import { db, getSettings, handle } from '@/lib/server';
import { depositFor, type Service } from '@/lib/booking';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const [{ data }, s] = await Promise.all([db().from('services').select('*').eq('active', true).order('sort_order').order('name'), getSettings()]);
  const services = (data ?? []).map((x) => ({
    id: x.id, name: x.name, category: x.category ?? 'Outros', description: x.description, image_url: x.image_url, price_cents: x.price_cents, duration_min: x.duration_min,
    deposit_required: x.deposit_required, deposit_cents: depositFor(x as Service),
  }));
  return NextResponse.json({
    services, studio: s.studio, policy: s.policy.text, payment_methods: s.payment_methods,
    max_days_ahead: s.booking.max_days_ahead, hold_minutes: s.booking.hold_minutes,
  });
});
