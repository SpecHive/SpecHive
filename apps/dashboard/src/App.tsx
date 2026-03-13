import { BrowserRouter } from 'react-router';

import { ErrorBoundary } from './components/error-boundary';
import { AuthProvider } from './lib/auth-context';
import { PluginProvider, type DashboardPlugin } from './lib/plugin-registry';
import { ThemeProvider } from './lib/theme-context';
import { AppRoutes } from './routes';

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
