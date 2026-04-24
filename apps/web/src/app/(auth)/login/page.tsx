import { Suspense } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/features/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Вход',
};

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Вход</CardTitle>
        <CardDescription>Введите данные вашего аккаунта</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Загрузка…</div>}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
