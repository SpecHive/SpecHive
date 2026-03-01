import {
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Moon,
  PlayCircle,
  Settings,
  Sun,
} from 'lucide-react';
import { NavLink } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useTheme, type Theme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Runs', href: '/runs', icon: PlayCircle },
  { label: 'Tests', href: '/tests', icon: FlaskConical },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const themeIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'system' ? `System (${resolvedTheme})` : theme;
  const ThemeIcon = themeIcon;

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold tracking-tight">Assertly</span>
      </div>

      <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
        {navItems.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            end={href === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="mb-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-muted-foreground"
            onClick={cycleTheme}
            aria-label={`Current theme: ${themeLabel}. Click to change.`}
          >
            <ThemeIcon className="h-4 w-4" aria-hidden="true" />
            <span className="capitalize">{themeLabel}</span>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">v{__APP_VERSION__}</p>
      </div>
    </aside>
  );
}
