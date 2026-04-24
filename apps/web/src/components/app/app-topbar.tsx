'use client';

import { LogoutButton, selectUser, useSessionStore } from '@/features/auth';

export function AppTopbar() {
  const user = useSessionStore(selectUser);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">Рабочее пространство</div>
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        ) : null}
        <LogoutButton />
      </div>
    </header>
  );
}
