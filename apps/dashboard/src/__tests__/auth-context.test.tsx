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
    setOnUnauthorized: vi.fn(),
    setOnTokenRefresh: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
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

    // Reset mock to track logout call
    vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

    await userEvent.click(screen.getByText('Logout'));
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });
    expect(apiClient.setToken).toHaveBeenCalledWith(null);
    // Verify logout API call with empty body (cookie sent automatically)
    expect(apiClient.post).toHaveBeenCalledWith('/v1/auth/logout', {});
  });

  describe('sessionStorage persistence', () => {
    it('persists auth state to sessionStorage on login', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLoginResponse);

      renderWithAuth();
      await userEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      expect(sessionStorage.getItem('spechive_token')).toBe('jwt-token');
      expect(JSON.parse(sessionStorage.getItem('spechive_user')!)).toEqual(mockLoginResponse.user);
      expect(JSON.parse(sessionStorage.getItem('spechive_org')!)).toEqual(
        mockLoginResponse.organization,
      );
    });

    it('restores auth state from sessionStorage on mount', () => {
      sessionStorage.setItem('spechive_token', 'stored-token');
      sessionStorage.setItem('spechive_user', JSON.stringify(mockLoginResponse.user));
      sessionStorage.setItem('spechive_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      expect(apiClient.setToken).toHaveBeenCalledWith('stored-token');
    });

    it('clears sessionStorage on logout', async () => {
      sessionStorage.setItem('spechive_token', 'stored-token');
      sessionStorage.setItem('spechive_user', JSON.stringify(mockLoginResponse.user));
      sessionStorage.setItem('spechive_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

      await userEvent.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });

      expect(sessionStorage.getItem('spechive_token')).toBeNull();
      expect(sessionStorage.getItem('spechive_user')).toBeNull();
      expect(sessionStorage.getItem('spechive_org')).toBeNull();
    });

    it('falls back to unauthenticated when sessionStorage JSON is corrupted', () => {
      sessionStorage.setItem('spechive_token', 'stored-token');
      sessionStorage.setItem('spechive_user', '{invalid json');
      sessionStorage.setItem('spechive_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(sessionStorage.getItem('spechive_token')).toBeNull();
      expect(sessionStorage.getItem('spechive_user')).toBeNull();
      expect(sessionStorage.getItem('spechive_org')).toBeNull();
    });

    it('falls back to unauthenticated when token exists but user is missing', () => {
      sessionStorage.setItem('spechive_token', 'stored-token');
      sessionStorage.setItem('spechive_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(sessionStorage.getItem('spechive_token')).toBeNull();
    });
  });

  describe('session management', () => {
    it('registers onUnauthorized callback', () => {
      renderWithAuth();
      expect(apiClient.setOnUnauthorized).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers onTokenRefresh callback', () => {
      renderWithAuth();
      expect(apiClient.setOnTokenRefresh).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
