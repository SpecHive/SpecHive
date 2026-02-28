import { BrowserRouter } from 'react-router';

import { AuthProvider } from './lib/auth-context';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
