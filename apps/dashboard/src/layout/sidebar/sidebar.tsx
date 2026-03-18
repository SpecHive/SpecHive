import { BarChart3, Key, LayoutDashboard, LogOut, PlayCircle, Settings } from 'lucide-react';
import { NavLink } from 'react-router';

import { OrgSwitcher } from './org-switcher';
import { ThemeToggle } from './theme-toggle';

import { useAuth } from '@/contexts/auth-context';
import { usePlugins, type NavItem } from '@/contexts/plugin-registry';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Runs', href: '/runs', icon: PlayCircle },
  { label: 'Comparison', href: '/comparison', icon: BarChart3 },
  { label: 'Tokens', href: '/tokens', icon: Key },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { logout, user, organization, switchOrganization } = useAuth();
  const plugins = usePlugins();
  const pluginNavItems = plugins.flatMap((p) => p.navItems ?? []);
  const allNavItems = [...navItems, ...pluginNavItems];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold tracking-tight">SpecHive</span>
      </div>

      <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
        {allNavItems.map(({ label, href, icon: Icon }) => (
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
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="mb-2 flex gap-2">
          <ThemeToggle />
        </div>
        {user && organization && (
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <OrgSwitcher currentOrg={organization} onSwitch={switchOrganization} />
          </div>
        )}
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
