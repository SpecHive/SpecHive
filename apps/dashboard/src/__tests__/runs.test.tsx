import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { RunsPage } from '@/pages/runs';

const mockUseApi = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApi: (...args: unknown[]) => mockUseApi(...args),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
    setRefreshToken: vi.fn(),
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

function renderRuns() {
  return render(
    <MemoryRouter initialEntries={['/runs']}>
      <AuthProvider>
        <RunsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RunsPage', () => {
  it('renders the page heading', () => {
    mockUseApi.mockReturnValue({ data: null, loading: false, error: null, refetch: vi.fn() });
    renderRuns();
    expect(screen.getByText('Test Runs')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path === '/v1/projects') {
        return {
          data: {
            data: [{ id: '1', name: 'Project', createdAt: null }],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return {
        data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    renderRuns();
    expect(screen.getByText('No runs found.')).toBeInTheDocument();
  });

  it('renders runs table', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path === '/v1/projects') {
        return {
          data: {
            data: [{ id: '1', name: 'Project', createdAt: null }],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return {
        data: {
          data: [
            {
              id: 'abcdefgh-1234-5678-9abc-def012345678',
              projectId: '1',
              status: 'passed',
              totalTests: 50,
              passedTests: 48,
              failedTests: 2,
              skippedTests: 0,
              startedAt: '2026-01-01T00:00:00Z',
              finishedAt: '2026-01-01T00:02:00Z',
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    renderRuns();
    expect(screen.getByText('abcdefgh')).toBeInTheDocument();
    expect(screen.getByText('48/50')).toBeInTheDocument();
  });
});
