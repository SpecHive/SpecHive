import './index.css';

export { App } from './App';
export { apiClient } from './shared/lib/api-client';
export { PluginProvider, usePlugins } from './contexts/plugin-registry';
export type { DashboardPlugin, RouteConfig, NavItem } from './contexts/plugin-registry';
