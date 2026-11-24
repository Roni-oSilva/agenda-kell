'use client';
import Link from 'next/link';
import { useEffect, useRef, type ComponentType } from 'react';

export type DockItem = { href: string; label: string; short: string; icon: ComponentType<{ 'aria-hidden'?: boolean }>; alert?: boolean };

/** Barra de navegação em vidro com indicador deslizante (lateral no computador, inferior no celular). */
export default function GlassDock({ items, active, side = false }: { items: DockItem[]; active: string; side?: boolean }) {
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = nav.current, indicator = marker.current;
    if (!container || !indicator) return;
    const adjust = () => {
      const cur = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!cur) { indicator.dataset.ready = 'false'; return; }
      indicator.style.width = `${cur.offsetWidth}px`;
      indicator.style.height = `${cur.offsetHeight}px`;
      indicator.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
      indicator.dataset.ready = 'true';
    };
    const ro = new ResizeObserver(adjust);
    ro.observe(container);
    container.querySelectorAll('a').forEach((a) => ro.observe(a));
    adjust();
    return () => ro.disconnect();
  }, [active]);

  return (
    <nav ref={nav} className={side ? 'gd-dock gd-dock-side' : 'gd-dock gd-dock-bottom'} aria-label={side ? 'Atalhos do painel' : 'Seções do painel'}>
      <span ref={marker} className="gd-dock-indicator" aria-hidden="true" />
      {items.map(({ href, label, short, icon: Icon, alert }) => (
        <Link href={href} key={href} aria-label={label} aria-current={active === href ? 'page' : undefined}>
          <Icon aria-hidden />
          <span className="gd-dock-text" aria-hidden="true">{label}</span>
          <span className="gd-dock-short" aria-hidden="true">{short}</span>
          {alert && <i className="gd-dock-dot" aria-hidden="true" />}
          {side && <span className="gd-dock-tip" aria-hidden="true">{label}</span>}
        </Link>
      ))}
    </nav>
  );
}
