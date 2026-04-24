'use client';

import { loginInputSchema } from '@app/contracts';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/shared/api/client';

import { authApi } from '../api/auth.api';
import { selectStatus, useSessionStore } from '../model/session.store';

interface FieldErrors {
  email?: string;
  password?: string;
  form?: string;
}

const sanitizeNext = (raw: string | null): string => {
  if (!raw) return '/projects';
  try {
    const decoded = decodeURIComponent(raw);
    // Only allow same-origin paths — prevent open redirect.
    if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  } catch {
    /* fallthrough */
  }
  return '/projects';
};

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const search = useSearchParams();
  const status = useSessionStore(selectStatus);
  const setSession = useSessionStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErrors({});

    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'email') next.email = issue.message;
        else if (key === 'password') next.password = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const session = await authApi.login(parsed.data);
      setSession(session);
      router.replace(sanitizeNext(search.get('next')));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({
          form:
            err.status === 401
              ? 'Неверный email или пароль'
              : err.message || 'Не удалось войти',
        });
      } else {
        setErrors({ form: 'Сетевая ошибка, повторите попытку' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || status === 'loading';

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled}
          aria-invalid={!!errors.email}
          required
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={disabled}
          aria-invalid={!!errors.password}
          required
        />
        {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
      </div>

      {errors.form ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" disabled={disabled}>
        {submitting ? 'Входим…' : 'Войти'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}
