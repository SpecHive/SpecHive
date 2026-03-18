import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface RouteConfig {
  /** App routes use absolute paths (e.g. "/billing"). Settings routes use relative paths (e.g. "billing"), since they are nested under /settings. */
  path: string;
  element: React.LazyExoticComponent<React.ComponentType>;
  layout: 'app' | 'settings';
}

export interface DashboardPlugin {
  id: string;
  routes?: RouteConfig[];
  navItems?: NavItem[];
  settingsNavItems?: NavItem[];
}

interface PluginContextValue {
  plugins: DashboardPlugin[];
}

const PluginContext = createContext<PluginContextValue>({ plugins: [] });

export function PluginProvider({
  plugins,
  children,
}: {
  plugins: DashboardPlugin[];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ plugins }), [plugins]);
  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

export function usePlugins(): DashboardPlugin[] {
  return useContext(PluginContext).plugins;
}
