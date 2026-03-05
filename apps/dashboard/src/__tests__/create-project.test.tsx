import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateProjectDialog } from '@/components/create-project-dialog';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    setRefreshToken: vi.fn(),
    setOnUnauthorized: vi.fn(),
    setOnTokenRefresh: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const mockOnClose = vi.fn();
const mockOnCreated = vi.fn();

function renderDialog(open = true) {
  return render(
    <CreateProjectDialog open={open} onClose={mockOnClose} onCreated={mockOnCreated} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateProjectDialog', () => {
  it('renders dialog with form when open', () => {
    renderDialog();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog(false);
    expect(screen.queryByText('Create Project')).not.toBeInTheDocument();
  });

  it('shows validation error for empty name on submit', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByText('Project name is required')).toBeInTheDocument();
  });

  it('shows validation error for whitespace-only name', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), '   ');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByText('Project name is required')).toBeInTheDocument();
  });

  it('shows validation error for name over 100 characters', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'a'.repeat(101));
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByText('Project name must be 100 characters or less')).toBeInTheDocument();
  });

  it('calls apiClient.post with correct path and body on valid submit', async () => {
    const mockProject = {
      id: 'p-1',
      name: 'My Project',
      organizationId: 'org-1',
      createdAt: null,
      updatedAt: null,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockProject);

    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'My Project');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/v1/projects', { name: 'My Project' });
    });
  });

  it('calls onCreated with returned ProjectResponse on success', async () => {
    const mockProject = {
      id: 'p-1',
      name: 'My Project',
      organizationId: 'org-1',
      createdAt: null,
      updatedAt: null,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockProject);

    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'My Project');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalledWith(mockProject);
    });
  });

  it('calls toast.success on successful creation', async () => {
    const mockProject = {
      id: 'p-1',
      name: 'My Project',
      organizationId: 'org-1',
      createdAt: null,
      updatedAt: null,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockProject);

    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'My Project');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Project "My Project" created');
    });
  });

  it('shows API error message inline on failure', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Name already exists'));

    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Dup Project');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText('Name already exists')).toBeInTheDocument();
    });
  });

  it('closes on Cancel button click', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    renderDialog();
    await userEvent.keyboard('{Escape}');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables input and buttons while submitting', async () => {
    let resolvePost: (value: unknown) => void;
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );

    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Test');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    // Resolve to clean up
    resolvePost!({
      id: 'p-1',
      name: 'Test',
      organizationId: 'org-1',
      createdAt: null,
      updatedAt: null,
    });
  });

  it('clears form state when reopened after close', async () => {
    const { unmount } = renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Leftover');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    unmount();

    // Re-render as open
    renderDialog();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });
});
