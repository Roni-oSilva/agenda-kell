import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });

export const IconDiamond = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3l9 9-9 9-9-9 9-9z" /><path d="M12 8v8M8 12h8" /></svg>;
export const IconCalendarX = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M10 14l4 4M14 14l-4 4" /></svg>;
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
export const IconClock = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconClose = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconChevron = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 14, height: 14, strokeWidth: 2.4, ...p })}><path d="M9 6l6 6-6 6" /></svg>;
export const IconBack = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M15 6l-6 6 6 6" /></svg>;
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" /></svg>;
export const IconUser = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>;
export const IconCard = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h4" /></svg>;
export const IconCheck = (p: SVGProps<SVGSVGElement>) => <svg {...base({ strokeWidth: 3, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconCopy = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>;

export const IconWhatsapp = (p: SVGProps<SVGSVGElement>) => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" />
    <path d="M9 8.5c-.4 1.800.9 4.200 2.600 5.600 1.500 1.200 3 1.700 4 .9.400-.4.300-1-.100-1.200l-1.500-.8c-.3-.1-.6 0-.8.300l-.4.500c-1-.4-2.200-1.600-2.700-2.600l.5-.4c.2-.2.300-.5.200-.8l-.7-1.500c-.2-.4-.8-.5-1.200-.2-.3.200-.6.600-.9 1.400z" />
  </svg>
);
export const IconInstagram = (p: SVGProps<SVGSVGElement>) => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden {...p}><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>
);

/** Frasco de esmalte (ilustração própria, vetorial). */
export function PolishBottle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 140" className={className} aria-hidden>
      <defs>
        <linearGradient id="pb-liq" x1="0" x2="1"><stop offset="0" stopColor="#c2127f" /><stop offset=".5" stopColor="#ee3fa6" /><stop offset="1" stopColor="#a30e6c" /></linearGradient>
        <linearGradient id="pb-cap" x1="0" x2="1"><stop offset="0" stopColor="#1c1224" /><stop offset=".5" stopColor="#4a3a58" /><stop offset="1" stopColor="#140b1b" /></linearGradient>
      </defs>
      <rect x="29" y="2" width="22" height="52" rx="6" fill="url(#pb-cap)" />
      <rect x="33" y="8" width="3" height="40" rx="1.5" fill="#fff" opacity=".18" />
      <rect x="24" y="52" width="32" height="8" rx="3" fill="#2a1d35" />
      <rect x="10" y="58" width="60" height="78" rx="16" fill="url(#pb-liq)" />
      <rect x="10" y="58" width="60" height="78" rx="16" fill="none" stroke="#fff" strokeOpacity=".25" />
      <path d="M18 70c0-4 3-8 8-8" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="16" y="104" width="48" height="22" rx="8" fill="#fff" opacity=".14" />
    </svg>
  );
}
