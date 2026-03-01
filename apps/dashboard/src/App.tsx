import { BrowserRouter } from 'react-router';

import { AuthProvider } from './lib/auth-context';
import { ThemeProvider } from './lib/theme-context';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
