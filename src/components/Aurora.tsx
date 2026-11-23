'use client';
import { usePathname } from 'next/navigation';

/** Fundo com manchas de cor suaves que flutuam devagar (decorativo, sem interação). */
export default function Aurora() {
  const path = usePathname();
  if (path.startsWith('/admin')) return null;
  const blobs = [
    { c: '#d9b9e8', s: 420, x: '-8%', y: '-6%', a: 'animate-drift', d: '0s' },
    { c: '#f3c9e6', s: 360, x: '62%', y: '8%', a: 'animate-drift2', d: '-6s' },
    { c: '#e7cf9f', s: 300, x: '20%', y: '58%', a: 'animate-drift', d: '-11s' },
    { c: '#c8a2dc', s: 380, x: '70%', y: '70%', a: 'animate-drift2', d: '-3s' },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {blobs.map((b, i) => <span key={i} className={`absolute rounded-full opacity-50 blur-3xl ${b.a}`} style={{ width: b.s, height: b.s, left: b.x, top: b.y, background: b.c, animationDelay: b.d }} />)}
    </div>
  );
}
