import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { RunDetailPage } from '@/pages/run-detail';

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

function renderRunDetail(id = 'abcdefgh-1234-5678-9abc-def012345678') {
  return render(
    <MemoryRouter initialEntries={[`/runs/${id}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/runs/:id" element={<RunDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const mockRun = {
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
  updatedAt: '2026-01-01T00:02:00Z',
  suiteCount: 3,
  metadata: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RunDetailPage', () => {
  it('shows loading skeleton', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderRunDetail();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows not found when run does not exist', () => {
    mockUseApi.mockReturnValue({
      data: null,
      loading: false,
      error: 'Not found',
      refetch: vi.fn(),
    });
    renderRunDetail();
    expect(screen.getByText('Run not found')).toBeInTheDocument();
  });

  it('renders run header', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path && path.includes('/tests')) {
        return {
          data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return { data: mockRun, loading: false, error: null, refetch: vi.fn() };
    });

    renderRunDetail();
    expect(screen.getByText('Run abcdefgh')).toBeInTheDocument();
    expect(screen.getByText('48/50 passed')).toBeInTheDocument();
    expect(screen.getByText('2 failed')).toBeInTheDocument();
    expect(screen.getByText('3 suites')).toBeInTheDocument();
  });

  it('renders tests table header', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path && path.includes('/tests')) {
        return {
          data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return { data: mockRun, loading: false, error: null, refetch: vi.fn() };
    });

    renderRunDetail();
    expect(screen.getByText('Tests')).toBeInTheDocument();
  });
});
