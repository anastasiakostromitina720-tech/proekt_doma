import Link from 'next/link';
import { FolderKanban, LayoutDashboard, Settings } from 'lucide-react';

import { cn } from '@/lib/utils';
import { routes } from '@/shared/config/routes';

const navItems = [
  { href: routes.dashboard.projects, label: 'Проекты', icon: FolderKanban },
  { href: routes.dashboard.settings, label: 'Настройки', icon: Settings },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/30 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <LayoutDashboard className="size-5 text-primary" />
        <span className="font-semibold tracking-tight">Proekt Doma</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground',
                'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
