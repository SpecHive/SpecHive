import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';

import { AppRoutes } from '@/routes';

describe('AppRoutes', () => {
  it('renders DashboardPage at root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders LoginPage at /login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
  });

  it('renders NotFoundPage for an unknown path', () => {
    render(
      <MemoryRouter initialEntries={['/this-path-does-not-exist']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});
