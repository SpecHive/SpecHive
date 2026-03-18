import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';
import { AppRoutes } from '@/routes';

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    get: vi
      .fn()
      .mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    post: vi.fn(),
    setToken: vi.fn(),
    setOnUnauthorized: vi.fn(),
    setOnTokenRefresh: vi.fn(),
    silentRefresh: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders LoginPage at /login', () => {
    renderRoute('/login');
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login from /', () => {
    renderRoute('/');
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login from /runs', () => {
    renderRoute('/runs');
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
  });

  it('renders NotFoundPage for an unknown path', () => {
    renderRoute('/this-path-does-not-exist');
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});
