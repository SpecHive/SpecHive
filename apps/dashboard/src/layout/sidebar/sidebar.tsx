import {
  AlertTriangle,
  BarChart3,
  Key,
  LayoutDashboard,
  LogOut,
  PlayCircle,
  Settings,
} from 'lucide-react';
import { NavLink } from 'react-router';

import { OrgSwitcher } from './org-switcher';
import { SpecHiveLogo } from './spechive-logo';
import { ThemeToggle } from './theme-toggle';

import { useAuth } from '@/contexts/auth-context';
import { usePlugins, type NavItem } from '@/contexts/plugin-registry';
import { cn } from '@/shared/lib/utils';

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Runs', href: '/runs', icon: PlayCircle },
  { label: 'Errors', href: '/errors', icon: AlertTriangle },
  { label: 'Comparison', href: '/comparison', icon: BarChart3 },
  { label: 'Tokens', href: '/tokens', icon: Key },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function Sidebar() {
  const { logout, user, organization, switchOrganization } = useAuth();
  const plugins = usePlugins();
  const pluginNavItems = plugins.flatMap((p) => p.navItems ?? []);
  const allWidgets = plugins.flatMap((p) => p.widgets ?? []);
  const orgHeaderWidgets = allWidgets.filter((w) => w.position === 'org-header');
  const sidebarWidgets = allWidgets.filter((w) => w.position === 'sidebar');
  const allNavItems = [...navItems, ...pluginNavItems];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <SpecHiveLogo className="h-5 w-5 shrink-0 text-green-500" />
        {organization ? (
          <OrgSwitcher currentOrg={organization} onSwitch={switchOrganization} />
        ) : (
          <span className="text-sm font-semibold tracking-tight">SpecHive</span>
        )}
        {orgHeaderWidgets.map((w, i) => (
          <w.component key={i} />
        ))}
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

      {sidebarWidgets.length > 0 && (
        <div className="border-t px-4 py-3 [&:not(:has(*))]:hidden">
          {sidebarWidgets.map((w, i) => (
            <w.component key={i} />
          ))}
        </div>
      )}

      {user && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {getInitials(user.name)}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
