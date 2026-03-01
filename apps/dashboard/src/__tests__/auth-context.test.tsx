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

const mockLoginResponse = {
  token: 'jwt-token',
  user: { id: '1', email: 'a@b.com', name: 'Test User' },
  organization: { id: '1', name: 'Test Org', slug: 'test-org' },
};

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
  sessionStorage.clear();
});

describe('AuthContext', () => {
  it('starts unauthenticated', () => {
    renderWithAuth();
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
  });

  it('logs in successfully', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockLoginResponse);

    renderWithAuth();

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(apiClient.setToken).toHaveBeenCalledWith('jwt-token');
  });

  it('logs out successfully', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockLoginResponse);

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

  describe('sessionStorage persistence', () => {
    it('persists auth state to sessionStorage on login', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLoginResponse);

      renderWithAuth();
      await userEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      expect(sessionStorage.getItem('assertly_token')).toBe('jwt-token');
      expect(JSON.parse(sessionStorage.getItem('assertly_user')!)).toEqual(mockLoginResponse.user);
      expect(JSON.parse(sessionStorage.getItem('assertly_org')!)).toEqual(
        mockLoginResponse.organization,
      );
    });

    it('restores auth state from sessionStorage on mount', () => {
      sessionStorage.setItem('assertly_token', 'stored-token');
      sessionStorage.setItem('assertly_user', JSON.stringify(mockLoginResponse.user));
      sessionStorage.setItem('assertly_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      expect(apiClient.setToken).toHaveBeenCalledWith('stored-token');
    });

    it('clears sessionStorage on logout', async () => {
      sessionStorage.setItem('assertly_token', 'stored-token');
      sessionStorage.setItem('assertly_user', JSON.stringify(mockLoginResponse.user));
      sessionStorage.setItem('assertly_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();
      await userEvent.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });

      expect(sessionStorage.getItem('assertly_token')).toBeNull();
      expect(sessionStorage.getItem('assertly_user')).toBeNull();
      expect(sessionStorage.getItem('assertly_org')).toBeNull();
    });

    it('falls back to unauthenticated when sessionStorage JSON is corrupted', () => {
      sessionStorage.setItem('assertly_token', 'stored-token');
      sessionStorage.setItem('assertly_user', '{invalid json');
      sessionStorage.setItem('assertly_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(sessionStorage.getItem('assertly_token')).toBeNull();
      expect(sessionStorage.getItem('assertly_user')).toBeNull();
      expect(sessionStorage.getItem('assertly_org')).toBeNull();
    });

    it('falls back to unauthenticated when token exists but user is missing', () => {
      sessionStorage.setItem('assertly_token', 'stored-token');
      sessionStorage.setItem('assertly_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(sessionStorage.getItem('assertly_token')).toBeNull();
    });
  });
});
