import { NextResponse } from 'next/server';
import { db } from '@/lib/server';

export const dynamic = 'force-dynamic';

// DIAGNOSTICO TEMPORARIO: mostra apenas o TIPO das chaves (prefixo), nunca o valor.
const kind = (k?: string) => (!k ? 'ausente' : k.startsWith('sb_secret_') ? 'sb_secret (ok para servidor)' : k.startsWith('sb_publishable_') ? 'sb_publishable (PUBLICA - errado no servidor)' : k.startsWith('eyJ') ? 'jwt legado (anon ou service_role)' : 'desconhecido');
export async function GET() {
  const out: Record<string, unknown> = {
    service_key: kind(process.env.SUPABASE_SERVICE_ROLE_KEY),
    anon_key: kind(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    url_host: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^https?:\/\//, '').split('.')[0],
  };
  try {
    const s = await db().from('services').select('id', { count: 'exact', head: true });
    out.services_count = s.count; out.services_error = s.error?.message ?? null;
    const t = await db().from('settings').select('key');
    out.settings_rows = t.data?.length ?? 0; out.settings_error = t.error?.message ?? null;
  } catch (e) { out.exception = String((e as Error).message); }
  return NextResponse.json(out);
}
