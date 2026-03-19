import './index.css';

export { App } from './App';
export { apiClient } from './shared/lib/api-client';
export { PluginProvider, usePlugins } from './contexts/plugin-registry';
export type { DashboardPlugin, RouteConfig, NavItem } from './contexts/plugin-registry';

// Data fetching
export { useApi } from './shared/hooks/use-api';
export type { UseApiResult } from './shared/hooks/use-api';

// UI primitives
export { cn } from './shared/lib/utils';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './shared/components/ui/card';
