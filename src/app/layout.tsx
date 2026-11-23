import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Great_Vibes, Jost } from 'next/font/google';
import './globals.css';
import Aurora from '@/components/Aurora';

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });
const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-jost', display: 'swap' });
const vibes = Great_Vibes({ subsets: ['latin'], weight: '400', variable: '--font-vibes', display: 'swap' });

export const metadata: Metadata = { title: 'Agendamento online | Nail Designer', description: 'Escolha o procedimento, veja os horários e agende online.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#5a2470' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${jost.variable} ${vibes.variable}`}>
      <body><Aurora /><div className="relative z-10">{children}</div></body>
    </html>
  );
}
