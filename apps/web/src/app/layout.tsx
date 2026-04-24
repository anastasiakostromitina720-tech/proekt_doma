import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { SessionBootstrap } from '@/features/auth';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Proekt Doma',
    template: '%s · Proekt Doma',
  },
  description:
    'Веб-приложение для проектирования, реконструкции и дизайна домов: 2D-план, 3D-просмотр, AI-редизайн по фото.',
  applicationName: 'Proekt Doma',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SessionBootstrap />
        {children}
      </body>
    </html>
  );
}
