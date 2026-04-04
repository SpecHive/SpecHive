import { BrowserRouter } from 'react-router';

import { AuthProvider } from './contexts/auth-context';
import { PluginProvider, type DashboardPlugin } from './contexts/plugin-registry';
import { SseProvider } from './contexts/sse-context';
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
          <SseProvider>
            <PluginProvider plugins={plugins}>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </PluginProvider>
          </SseProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
