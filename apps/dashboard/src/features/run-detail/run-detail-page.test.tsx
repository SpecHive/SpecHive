import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';
import { RunDetailPage } from '@/features/run-detail/run-detail-page';
import { apiClient } from '@/shared/lib/api-client';

const mockUseApi = vi.fn();

vi.mock('@/shared/hooks/use-api', () => ({
  useApi: (...args: unknown[]) => mockUseApi(...args),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
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

  describe('test detail drawer', () => {
    const mockTest = {
      id: 'test-1',
      suiteId: 'suite-1',
      runId: mockRun.id,
      name: 'should pass',
      status: 'failed',
      durationMs: 120,
      errorMessage: null,
      stackTrace: null,
      retryCount: 0,
      startedAt: '2026-01-01T00:00:00Z',
      finishedAt: '2026-01-01T00:00:01Z',
      createdAt: '2026-01-01T00:00:00Z',
    };

    function setupMocks(testDetail: Record<string, unknown>) {
      mockUseApi.mockImplementation((path: string) => {
        if (path && path.match(/\/tests\/test-1$/)) {
          return {
            data: { ...testDetail, updatedAt: null, artifacts: [], attempts: [] },
            loading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (path && path.includes('/tests')) {
          return {
            data: { data: [mockTest], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
            loading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return { data: mockRun, loading: false, error: null, refetch: vi.fn() };
      });
    }

    it('shows stack trace section when stackTrace is present', async () => {
      const user = userEvent.setup();
      setupMocks({ ...mockTest, stackTrace: 'Error: boom\n  at foo.ts:1:1' });
      renderRunDetail();

      await user.click(screen.getByText('should pass'));
      expect(screen.getByText('Show stack trace')).toBeInTheDocument();
    });

    it('hides stack trace section when stackTrace is null', async () => {
      const user = userEvent.setup();
      setupMocks({ ...mockTest, stackTrace: null, errorMessage: 'something broke' });
      renderRunDetail();

      await user.click(screen.getByText('should pass'));
      expect(screen.queryByText('Show stack trace')).not.toBeInTheDocument();
      expect(screen.getByText('something broke')).toBeInTheDocument();
    });

    it('shows error message section when errorMessage is present', async () => {
      const user = userEvent.setup();
      setupMocks({ ...mockTest, errorMessage: 'assertion failed', stackTrace: null });
      renderRunDetail();

      await user.click(screen.getByText('should pass'));
      expect(screen.getByText('assertion failed')).toBeInTheDocument();
      expect(screen.queryByText('Show stack trace')).not.toBeInTheDocument();
    });

    it('shows both error and stack trace independently', async () => {
      const user = userEvent.setup();
      setupMocks({
        ...mockTest,
        errorMessage: 'assertion failed',
        stackTrace: 'Error: boom\n  at bar.ts:2:3',
      });
      renderRunDetail();

      await user.click(screen.getByText('should pass'));
      expect(screen.getByText('assertion failed')).toBeInTheDocument();
      expect(screen.getByText('Show stack trace')).toBeInTheDocument();
    });

    it('renders stack trace content when expanded', async () => {
      const user = userEvent.setup();
      setupMocks({ ...mockTest, stackTrace: 'Error: boom\n  at foo.ts:1:1' });
      renderRunDetail();

      await user.click(screen.getByText('should pass'));
      await user.click(screen.getByText('Show stack trace'));

      const pre = document.querySelector('pre');
      expect(pre).toBeInTheDocument();
      expect(pre?.textContent).toContain('Error: boom');
      expect(pre?.textContent).toContain('at foo.ts:1:1');
      expect(screen.getByText('Hide stack trace')).toBeInTheDocument();
    });

    it('shows toast on download failure', async () => {
      const user = userEvent.setup();
      const artifact = {
        id: 'art-1',
        type: 'screenshot',
        name: 'fail.png',
        sizeBytes: 1024,
        mimeType: 'image/png',
        retryIndex: null,
        createdAt: '2026-01-01',
      };

      mockUseApi.mockImplementation((path: string) => {
        if (path && path.match(/\/tests\/test-1$/)) {
          return {
            data: { ...mockTest, updatedAt: null, artifacts: [artifact], attempts: [] },
            loading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (path && path.includes('/tests')) {
          return {
            data: { data: [mockTest], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
            loading: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return { data: mockRun, loading: false, error: null, refetch: vi.fn() };
      });

      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network error'));

      renderRunDetail();
      await user.click(screen.getByText('should pass'));

      // Find the download button in the artifacts section (it contains an SVG icon)
      const artifactName = screen.getByText('fail.png');
      const artifactRow = artifactName.closest('div[class*="flex"]')!;
      const downloadBtn = artifactRow.querySelector('button')!;
      await user.click(downloadBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Download failed');
      });
    });
  });
});
