import { BrowserRouter } from 'react-router';

import { ErrorBoundary } from './components/error-boundary';
import { AuthProvider } from './lib/auth-context';
import { ThemeProvider } from './lib/theme-context';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
