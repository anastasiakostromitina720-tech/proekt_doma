'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { selectUser, useSessionStore } from '@/features/auth';
import { routes } from '@/shared/config/routes';

export default function SettingsPage() {
  const user = useSessionStore(selectUser);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Настройки профиля</h1>

      <Card>
        <CardHeader>
          <CardTitle>Аккаунт</CardTitle>
          <CardDescription>Данные текущего пользователя</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {user ? (
            <>
              <div>
                <span className="text-muted-foreground">Имя: </span>
                <span className="font-medium">{user.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{user.email}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Сессия загружается…</p>
          )}
        </CardContent>
      </Card>

      <p className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Раздел в разработке. Здесь позже появятся настройки уведомлений, внешнего вида и
        привязки внешних сервисов.
      </p>

      <Button asChild variant="outline">
        <Link href={routes.dashboard.projects}>← К проектам</Link>
      </Button>
    </div>
  );
}
