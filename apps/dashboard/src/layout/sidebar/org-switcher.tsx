import { Check, ChevronsUpDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient } from '@/shared/lib/api-client';
import { cn } from '@/shared/lib/utils';
import type { Organization } from '@/types/api';

interface OrgSwitcherProps {
  currentOrg: { id: string; name: string };
  onSwitch: (orgId: string) => Promise<void>;
}

export function OrgSwitcher({ currentOrg, onSwitch }: OrgSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient
      .get<{ data: Organization[] }>('/v1/auth/organizations')
      .then((res) => setOrganizations(res.data))
      .catch((error) => {
        console.warn('[org-switcher] Failed to load organizations:', error);
      });
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
      if (orgId === currentOrg.id || isSwitching) return;
      setIsSwitching(true);
      try {
        await onSwitch(orgId);
      } catch {
        // On failure stay put; on success the caller navigates
      } finally {
        setIsSwitching(false);
        setIsOpen(false);
      }
    },
    [currentOrg.id, isSwitching, onSwitch],
  );

  const hasMultipleOrgs = organizations.length > 1;

  if (!hasMultipleOrgs) {
    return <span className="truncate text-sm font-semibold tracking-tight">{currentOrg.name}</span>;
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-1 rounded-md py-0.5 text-sm font-semibold tracking-tight transition-colors hover:text-accent-foreground"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
      >
        <span className="truncate">{currentOrg.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover py-1 shadow-md">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                org.id === currentOrg.id ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => handleSwitch(org.id)}
              disabled={isSwitching}
            >
              <Check
                className={cn(
                  'h-3 w-3 shrink-0',
                  org.id === currentOrg.id ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <span className="truncate">{org.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
