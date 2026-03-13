import { NavLink, Outlet } from 'react-router';

import { usePlugins } from '@/lib/plugin-registry';
import { cn } from '@/lib/utils';

const settingsNavItems = [
  { label: 'Profile', href: '/settings/profile' },
  { label: 'Members', href: '/settings/members' },
];

export function SettingsLayout() {
  const plugins = usePlugins();
  const pluginSettingsItems = plugins.flatMap((p) => p.settingsNavItems ?? []);
  const allSettingsItems = [...settingsNavItems, ...pluginSettingsItems];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <div className="flex gap-8">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {allSettingsItems.map(({ label, href }) => (
              <li key={href}>
                <NavLink
                  to={href}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )
                  }
                >
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
