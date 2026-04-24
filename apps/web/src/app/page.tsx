import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { routes } from '@/shared/config/routes';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <Link href={routes.home} className="font-semibold tracking-tight">
          Proekt Doma
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={routes.login}>Войти</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={routes.register}>Начать</Link>
          </Button>
        </nav>
      </header>

      <section className="container flex flex-1 flex-col items-center justify-center py-24 text-center">
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Спроектируйте дом в 2D, посмотрите в 3D, переосмыслите интерьер с AI
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Платформа для проектирования, реконструкции и дизайна жилых пространств.
          Сейчас в разработке — готовим MVP.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href={routes.dashboard.projects}>Открыть рабочее пространство</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={routes.register}>Создать аккаунт</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Proekt Doma
      </footer>
    </main>
  );
}
