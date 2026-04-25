import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Настройки',
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
