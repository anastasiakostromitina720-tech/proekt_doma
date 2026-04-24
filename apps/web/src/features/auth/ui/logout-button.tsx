'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { authApi } from '../api/auth.api';
import { useSessionStore } from '../model/session.store';

export function LogoutButton(): JSX.Element {
  const router = useRouter();
  const clearSession = useSessionStore((s) => s.clearSession);
  const [pending, setPending] = useState(false);

  const onClick = async (): Promise<void> => {
    setPending(true);
    try {
      await authApi.logout();
    } catch {
      // Even if the server request fails, we still clear local state.
    } finally {
      clearSession();
      router.replace('/login');
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? 'Выход…' : 'Выйти'}
    </Button>
  );
}
