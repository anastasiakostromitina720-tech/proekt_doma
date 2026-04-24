import { Suspense } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/features/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Регистрация',
};

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Создание аккаунта</CardTitle>
        <CardDescription>Зарегистрируйтесь, чтобы начать проектировать</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Загрузка…</div>}>
          <RegisterForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
