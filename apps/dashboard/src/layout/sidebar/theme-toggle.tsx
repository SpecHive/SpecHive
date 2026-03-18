import { Moon, Sun } from 'lucide-react';

import { useTheme, type Theme } from '@/contexts/theme-context';
import { Button } from '@/shared/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'system' ? `System (${resolvedTheme})` : theme;

  return (
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
  );
}
