'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, CircleDollarSign, Clock3, Hourglass, LayoutDashboard, LogOut, MessageCircle, Settings, Sparkles, Users } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import '@fontsource-variable/manrope';
import '@/components/ui/glass-admin.css';
import GlassDock, { type DockItem } from '@/components/ui/glass-dock';
import { api } from '@/lib/client';

type Summary = { toConfirm: unknown[]; toAccept: unknown[]; waitingPix: unknown[] };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const login = path === '/admin/login';
  const [pending, setPending] = useState(0);

  // avisos: confere a cada 30s se há PIX para conferir ou pedidos para aceitar (badge + título da aba)
  useEffect(() => {
    if (login) return;
    let off = false;
    const tick = () => api<Summary>('/api/admin/summary').then((s) => { if (!off) setPending(s.toConfirm.length + s.toAccept.length); }).catch(() => {});
    tick();
    const t = setInterval(tick, 30_000);
    return () => { off = true; clearInterval(t); };
  }, [login]);
  useEffect(() => {
    if (login) return;
    document.title = pending > 0 ? `(${pending}) Painel | Agenda` : 'Painel | Agenda';
  }, [pending, login]);

  if (login) return <>{children}</>;

  const items: DockItem[] = [
    { href: '/admin', label: 'Início', short: 'Início', icon: LayoutDashboard, alert: pending > 0 },
    { href: '/admin/agenda', label: 'Agenda', short: 'Agenda', icon: CalendarDays },
    { href: '/admin/servicos', label: 'Procedimentos', short: 'Serviços', icon: Sparkles },
    { href: '/admin/disponibilidade', label: 'Horários', short: 'Horários', icon: Clock3 },
    { href: '/admin/clientes', label: 'Clientes', short: 'Clientes', icon: Users },
    { href: '/admin/financeiro', label: 'Financeiro', short: 'Caixa', icon: CircleDollarSign },
    { href: '/admin/whatsapp', label: 'WhatsApp', short: 'Zap', icon: MessageCircle },
    { href: '/admin/espera', label: 'Lista de espera', short: 'Espera', icon: Hourglass },
    { href: '/admin/configuracoes', label: 'Configurações', short: 'Config.', icon: Settings },
  ];
  const active = items.slice().sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === '/admin' ? path === '/admin' : path.startsWith(i.href)))?.href ?? '/admin';

  async function out() {
    await createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).auth.signOut();
    window.location.href = '/admin/login';
  }

  return (
    <div className="gd-app">
      <div className="gd-surround">
        <header className="gd-top">
          <div className="gd-brand">
            <span className="gd-logo" aria-hidden="true">A</span>
            <div><strong>Painel</strong><small>Agenda da profissional</small></div>
          </div>
          <div className="gd-top-actions">
            <a href="/admin" className="gd-icon-button" aria-label={pending > 0 ? `${pending} itens precisam da sua atenção` : 'Nada pendente'}>
              <Bell aria-hidden />{pending > 0 && <span className="gd-badge">{pending}</span>}
            </a>
            <button type="button" className="gd-icon-button" aria-label="Sair" title="Sair" onClick={out}><LogOut aria-hidden /></button>
          </div>
        </header>
        <div className="gd-stage-wrap">
          <GlassDock items={items} active={active} side />
          <main className="gd-stage">
            <div className="gd-stage-scroll"><div key={path} className="animate-fadeUp">{children}</div></div>
          </main>
          <GlassDock items={items} active={active} />
        </div>
      </div>
    </div>
  );
}
