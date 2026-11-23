import type { Metadata, Viewport } from 'next';
import './globals.css';
import Aurora from '@/components/Aurora';

export const metadata: Metadata = { title: 'Agendamento online | Nail Designer', description: 'Escolha o procedimento, veja os horários e agende online.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#5a2470' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Jost:wght@300;400;500;600&family=Great+Vibes&display=swap" />
      </head>
      <body><Aurora /><div className="relative z-10">{children}</div></body>
    </html>
  );
}
