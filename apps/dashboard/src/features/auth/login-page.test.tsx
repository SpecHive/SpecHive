import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';
import { LoginPage } from '@/features/auth/login-page';
import { apiClient } from '@/shared/lib/api-client';

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders the email input', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders the password input', () => {
    renderLogin();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders the sign in button as enabled', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  it('renders the SpecHive card title', () => {
    renderLogin();
    expect(screen.getByText('SpecHive')).toBeInTheDocument();
  });

  it('shows error when submitting empty form', async () => {
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Email and password are required')).toBeInTheDocument();
  });

  it('calls login on valid submit', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      token: 'jwt',
      user: { id: '1', email: 'a@b.com', name: 'User' },
      organization: { id: '1', name: 'Org', slug: 'org' },
    });

    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/v1/auth/login', {
        email: 'a@b.com',
        password: 'password',
      });
    });
  });

  it('shows error on login failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
