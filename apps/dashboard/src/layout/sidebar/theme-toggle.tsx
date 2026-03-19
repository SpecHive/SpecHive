import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTheme, type Theme } from '@/contexts/theme-context';
import { cn } from '@/shared/lib/utils';

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const ResolvedIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Theme: ${theme}. Click to change.`}
      >
        <ResolvedIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-1 w-36 rounded-md border bg-popover py-1 shadow-md">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                theme === value ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
              <Check
                className={cn(
                  'ml-auto h-3 w-3 shrink-0',
                  theme === value ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
