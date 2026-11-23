'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const LINKS = [['/admin', 'Agenda'], ['/admin/servicos', 'Procedimentos'], ['/admin/disponibilidade', 'Horários'], ['/admin/clientes', 'Clientes'], ['/admin/financeiro', 'Financeiro'], ['/admin/whatsapp', 'WhatsApp'], ['/admin/espera', 'Espera'], ['/admin/configuracoes', 'Config.']];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === '/admin/login') return <>{children}</>;
  async function out() {
    await createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).auth.signOut();
    window.location.href = '/admin/login';
  }
  return (
    <div className="mx-auto max-w-5xl px-3 py-3">
      <nav className="sticky top-2 z-30 mb-5 flex items-center gap-1 overflow-x-auto rounded-3xl bg-gradient-to-r from-rose-700 via-rose-600 to-rose-500 p-2 shadow-lift">
        <span className="hidden whitespace-nowrap px-3 font-script text-2xl text-ouro-2 sm:block">Painel</span>
        {LINKS.map(([h, l]) => <Link key={h} href={h} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition duration-300 ${path === h ? 'bg-white font-semibold text-rose-600 shadow' : 'text-white/90 hover:bg-white/15'}`}>{l}</Link>)}
        <button onClick={out} className="ml-auto whitespace-nowrap px-3 py-2 text-sm text-white/80 transition hover:text-white">Sair</button>
      </nav>
      <div key={path} className="animate-fadeUp">{children}</div>
    </div>
  );
}
