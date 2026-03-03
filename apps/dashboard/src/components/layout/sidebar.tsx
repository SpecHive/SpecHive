import {
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Moon,
  PlayCircle,
  Sun,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useTheme, type Theme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import type { Organization } from '@/types/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Runs', href: '/runs', icon: PlayCircle },
];

export function Sidebar() {
  const { logout, user, organization, switchOrganization } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient
      .get<{ data: Organization[] }>('/v1/auth/organizations')
      .then((res) => setOrganizations(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSwitch = useCallback(
    async (orgId: string) => {
      if (orgId === organization?.id || isSwitching) return;
      setIsSwitching(true);
      try {
        await switchOrganization(orgId);
      } catch {
        // On failure stay put; on success switchOrganization navigates
      } finally {
        setIsSwitching(false);
        setIsOpen(false);
      }
    },
    [organization?.id, isSwitching, switchOrganization],
  );

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const themeIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'system' ? `System (${resolvedTheme})` : theme;
  const ThemeIcon = themeIcon;

  const isMultiOrg = organizations.length > 1;

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
        {user && organization && (
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            {isMultiOrg ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setIsOpen((prev) => !prev)}
                  disabled={isSwitching}
                >
                  <span className="truncate">{organization.name}</span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-md border bg-popover py-1 shadow-md">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                          org.id === organization.id
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground',
                        )}
                        onClick={() => handleSwitch(org.id)}
                        disabled={isSwitching}
                      >
                        <Check
                          className={cn(
                            'h-3 w-3 shrink-0',
                            org.id === organization.id ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{org.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="truncate text-xs text-muted-foreground">{organization.name}</p>
            )}
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
