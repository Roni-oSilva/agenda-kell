import { NextResponse } from 'next/server';
import { audit, db, handle, requireAdmin } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Exportação manual (JSON) de todas as tabelas. Backups automáticos: ative os backups diários/PITR do Supabase.
const TABLES = ['customers', 'customer_profiles', 'services', 'bookings', 'payments', 'weekly_hours', 'breaks', 'blocks', 'settings', 'notifications', 'waitlist', 'followups', 'audit_log'];
export const GET = handle(async () => {
  const u = await requireAdmin();
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of TABLES) out[t] = (await db().from(t).select('*').limit(50000)).data;
  await audit(u.email ?? u.id, 'backup_manual', 'system', 'all');
  return new NextResponse(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"` } });
});
