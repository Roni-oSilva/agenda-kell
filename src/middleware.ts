import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Protege /admin/* (exceto login). As rotas /api/admin/* conferem a permissão no próprio handler (requireAdmin).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const login = req.nextUrl.pathname === '/admin/login';
  if (!url || !key) return login ? res : NextResponse.redirect(new URL('/admin/login', req.url));
  const supa = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: Parameters<typeof res.cookies.set>[2] }[]) => { list.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: req }); list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); },
    },
  });
  const { data } = await supa.auth.getUser(); // revalida o token e renova cookies
  if (!data.user && !login) return NextResponse.redirect(new URL('/admin/login', req.url));
  if (data.user && login) return NextResponse.redirect(new URL('/admin', req.url));
  return res;
}
export const config = { matcher: ['/admin/:path*'] };
