import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TokensPage } from '@/features/tokens/tokens-page';
import { apiClient } from '@/shared/lib/api-client';

const mockUseApi = vi.fn();

vi.mock('@/shared/hooks/use-api', () => ({
  useApi: (...args: unknown[]) => mockUseApi(...args),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    setOnUnauthorized: vi.fn(),
    setOnTokenRefresh: vi.fn(),
    silentRefresh: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/contexts/project-context', () => ({
  useProject: () => ({
    projects: [{ id: 'proj-1', name: 'Project', createdAt: null }],
    selectedProjectIds: ['proj-1'],
    isAllSelected: false,
    setSelectedProjectIds: vi.fn(),
    loading: false,
    refetchProjects: vi.fn(),
  }),
}));

const defaultApiResult = { data: null, loading: false, error: null, refetch: vi.fn() };

const mockTokens = {
  data: [
    {
      id: 'tok-1',
      name: 'CI Token',
      tokenPrefix: 'ast_abc',
      createdAt: '2026-03-01T00:00:00Z',
      lastUsedAt: '2026-03-04T00:00:00Z',
      revokedAt: null,
    },
    {
      id: 'tok-2',
      name: 'Old Token',
      tokenPrefix: 'ast_xyz',
      createdAt: '2026-02-01T00:00:00Z',
      lastUsedAt: null,
      revokedAt: '2026-02-15T00:00:00Z',
    },
  ],
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
};

function renderTokens() {
  return render(
    <MemoryRouter initialEntries={['/tokens']}>
      <TokensPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('TokensPage', () => {
  it('renders token list table with active and revoked tokens', () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    renderTokens();

    expect(screen.getByText('CI Token')).toBeInTheDocument();
    expect(screen.getByText('Old Token')).toBeInTheDocument();
  });

  it('shows Active for tokens without revokedAt', () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    renderTokens();

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Revoked for tokens with revokedAt', () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    renderTokens();

    expect(screen.getByText(/Revoked/)).toBeInTheDocument();
  });

  it('disables revoke button for already-revoked tokens', () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    renderTokens();

    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    // First token (active) — enabled; second (revoked) — disabled
    expect(revokeButtons[0]).toBeEnabled();
    expect(revokeButtons[1]).toBeDisabled();
  });

  it('shows empty state when no tokens', () => {
    mockUseApi.mockReturnValue({
      ...defaultApiResult,
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
    });
    renderTokens();

    expect(
      screen.getByText('No tokens yet. Generate one to start sending test results.'),
    ).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, loading: true });
    renderTokens();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('opens create dialog and submits to show one-time token', async () => {
    const refetch = vi.fn();
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens, refetch });

    const mockCreated = {
      id: 'tok-3',
      name: 'New Token',
      tokenPrefix: 'ast_new',
      token: 'ast_new_full_secret_token_value',
      createdAt: '2026-03-05T00:00:00Z',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockCreated);

    renderTokens();

    await userEvent.click(screen.getAllByRole('button', { name: /generate token/i })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'New Token');
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/v1/tokens', {
        name: 'New Token',
        projectId: 'proj-1',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Token Created')).toBeInTheDocument();
      expect(screen.getByText('ast_new_full_secret_token_value')).toBeInTheDocument();
      expect(
        screen.getByText('This token will only be shown once. Copy it now.'),
      ).toBeInTheDocument();
    });

    expect(refetch).toHaveBeenCalled();
  });

  it('copies token to clipboard on copy click', async () => {
    const refetch = vi.fn();
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens, refetch });

    const mockCreated = {
      id: 'tok-3',
      name: 'Copy Test',
      tokenPrefix: 'ast_cp',
      token: 'ast_cp_full_secret',
      createdAt: '2026-03-05T00:00:00Z',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockCreated);

    renderTokens();
    await userEvent.click(screen.getAllByRole('button', { name: /generate token/i })[0]);
    await userEvent.type(screen.getByLabelText('Name'), 'Copy Test');
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(screen.getByText('ast_cp_full_secret')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /copy token/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ast_cp_full_secret');
      expect(toast.success).toHaveBeenCalledWith('Copied!');
    });
  });

  it('shows revoke confirmation and calls delete on confirm', async () => {
    const refetch = vi.fn();
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens, refetch });
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    renderTokens();

    // Click revoke on the first (active) token
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    await userEvent.click(revokeButtons[0]);

    expect(screen.getByText('Revoke Token')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to revoke/)).toBeInTheDocument();

    // Find the destructive revoke button in the confirmation dialog
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: /^revoke$/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/v1/tokens/tok-1');
      expect(toast.success).toHaveBeenCalledWith('Token "CI Token" revoked');
      expect(refetch).toHaveBeenCalled();
    });
  });

  it('dismisses revoke confirmation without calling delete', async () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });

    renderTokens();

    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    await userEvent.click(revokeButtons[0]);

    expect(screen.getByText('Revoke Token')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('shows toast on create failure', async () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Limit reached'));

    renderTokens();
    await userEvent.click(screen.getAllByRole('button', { name: /generate token/i })[0]);
    await userEvent.type(screen.getByLabelText('Name'), 'Fail Token');
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }));

    await waitFor(() => {
      expect(screen.getByText('Limit reached')).toBeInTheDocument();
    });
  });

  it('shows toast on revoke failure', async () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('Server error'));

    renderTokens();

    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    await userEvent.click(revokeButtons[0]);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^revoke$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('validates empty token name on create', async () => {
    mockUseApi.mockReturnValue({ ...defaultApiResult, data: mockTokens });
    renderTokens();

    await userEvent.click(screen.getAllByRole('button', { name: /generate token/i })[0]);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }));

    expect(screen.getByText('Token name is required')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
