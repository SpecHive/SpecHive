import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { DashboardPage } from '@/pages/dashboard';

const mockUseApi = vi.fn();

vi.mock('@/hooks/use-api', () => ({
  useApi: (...args: unknown[]) => mockUseApi(...args),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
  },
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('shows loading skeleton', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderDashboard();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no runs', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path === '/v1/projects') {
        return {
          data: {
            data: [{ id: '1', name: 'Project', slug: 'project', createdAt: null }],
            meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return {
        data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    renderDashboard();
    expect(
      screen.getByText('No test runs found. Push some test results to get started.'),
    ).toBeInTheDocument();
  });

  it('renders stats when runs exist', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path === '/v1/projects') {
        return {
          data: {
            data: [{ id: '1', name: 'Project', slug: 'project', createdAt: null }],
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
              id: 'run-1',
              projectId: '1',
              status: 'passed',
              totalTests: 100,
              passedTests: 95,
              failedTests: 5,
              skippedTests: 0,
              startedAt: '2026-01-01T00:00:00Z',
              finishedAt: '2026-01-01T00:03:00Z',
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
          meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    renderDashboard();
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('Failed Tests')).toBeInTheDocument();
    expect(screen.getByText('Avg. Duration')).toBeInTheDocument();
  });
});
