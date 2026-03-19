import { User, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { usePlugins, type NavItem } from '@/contexts/plugin-registry';
import { PageHeader } from '@/layout/page-header';
import { cn } from '@/shared/lib/utils';

const settingsNavItems: NavItem[] = [
  { label: 'Profile', href: '/settings/profile', icon: User },
  { label: 'Members', href: '/settings/members', icon: Users },
];

export function SettingsLayout() {
  const plugins = usePlugins();
  const pluginSettingsItems = plugins.flatMap((p) => p.settingsNavItems ?? []);
  const allSettingsItems = [...settingsNavItems, ...pluginSettingsItems];

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title="Settings"
          description="Manage your account and team."
          showProjectSelector={false}
        />
      </div>
      <div className="flex gap-8">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {allSettingsItems.map(({ label, href, icon: Icon }) => (
              <li key={href}>
                <NavLink
                  to={href}
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
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
