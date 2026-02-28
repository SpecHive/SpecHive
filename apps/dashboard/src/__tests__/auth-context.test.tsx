import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import { AuthProvider, useAuth } from '@/lib/auth-context';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    setToken: vi.fn(),
  },
}));

function TestConsumer() {
  const { isAuthenticated, user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
      {user && <span data-testid="user-name">{user.name}</span>}
      <button onClick={() => login('a@b.com', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  it('starts unauthenticated', () => {
    renderWithAuth();
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
  });

  it('logs in successfully', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', email: 'a@b.com', name: 'Test User' },
      organization: { id: '1', name: 'Test Org', slug: 'test-org' },
    });

    renderWithAuth();

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(apiClient.setToken).toHaveBeenCalledWith('jwt-token');
  });

  it('logs out successfully', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', email: 'a@b.com', name: 'Test User' },
      organization: { id: '1', name: 'Test Org', slug: 'test-org' },
    });

    renderWithAuth();

    await userEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    await userEvent.click(screen.getByText('Logout'));
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });
    expect(apiClient.setToken).toHaveBeenCalledWith(null);
  });
});
