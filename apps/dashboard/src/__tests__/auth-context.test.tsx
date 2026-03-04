import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import { AuthProvider, useAuth } from '@/lib/auth-context';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    setToken: vi.fn(),
    setOnUnauthorized: vi.fn(),
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

  describe('session expiry warning', () => {
    function makeJwt(expUnix: number): string {
      const header = btoa(JSON.stringify({ alg: 'HS256' }));
      const payload = btoa(JSON.stringify({ exp: expUnix }));
      return `${header}.${payload}.sig`;
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows warning toast 5 minutes before expiry', () => {
      vi.useFakeTimers();
      const now = Date.now();
      const expiry = Math.floor((now + 10 * 60 * 1000) / 1000);
      const jwt = makeJwt(expiry);

      sessionStorage.setItem('assertly_token', jwt);
      sessionStorage.setItem('assertly_user', JSON.stringify(mockLoginResponse.user));
      sessionStorage.setItem('assertly_org', JSON.stringify(mockLoginResponse.organization));

      renderWithAuth();

      expect(toast.warning).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(toast.warning).toHaveBeenCalledWith(
        'Your session expires in 5 minutes. Please save your work.',
        { id: 'session-expiry-warning' },
      );
    });

    it('registers onUnauthorized callback', () => {
      renderWithAuth();
      expect(apiClient.setOnUnauthorized).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
