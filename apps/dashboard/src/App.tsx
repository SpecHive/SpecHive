import { BrowserRouter } from 'react-router';

import { AuthProvider } from './contexts/auth-context';
import { PluginProvider, type DashboardPlugin } from './contexts/plugin-registry';
import { ThemeProvider } from './contexts/theme-context';
import { AppRoutes } from './routes';
import { ErrorBoundary } from './shared/components/error-boundary';

interface AppProps {
  plugins?: DashboardPlugin[];
}

export function App({ plugins = [] }: AppProps) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PluginProvider plugins={plugins}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </PluginProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
