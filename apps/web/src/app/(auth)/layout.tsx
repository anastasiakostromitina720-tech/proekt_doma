'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { selectStatus, useSessionStore } from '@/features/auth';

/**
 * Layout for public auth pages (/login, /register).
 *
 * If the user is already authenticated — i.e. the SessionBootstrap
 * silent refresh succeeded — we bounce them to the requested next page
 * (or /projects) instead of showing the login form.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const status = useSessionStore(selectStatus);
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const nextParam = search.get('next');
    const target =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? decodeURIComponent(nextParam)
        : '/projects';
    router.replace(target);
  }, [status, router, search]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
