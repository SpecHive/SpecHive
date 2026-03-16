import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('@/lib/project-context', () => ({
  useProject: () => ({
    projects: [{ id: 'proj-1', name: 'Project', createdAt: null }],
    selectedProjectId: 'proj-1',
    setSelectedProjectId: vi.fn(),
    loading: false,
    refetchProjects: vi.fn(),
  }),
}));

const mockSummary = {
  totalRuns: 42,
  totalTests: 500,
  passedTests: 450,
  failedTests: 30,
  skippedTests: 15,
  flakyTests: 5,
  retriedTests: 7,
  passRate: 90.0,
  avgDurationMs: 125000,
};

const mockTrend = [
  { date: '2026-03-01', passRate: 88.5, totalTests: 100, passedTests: 88, failedTests: 12 },
  { date: '2026-03-02', passRate: 92.0, totalTests: 100, passedTests: 92, failedTests: 8 },
];

const mockDuration = [
  { date: '2026-03-01', avgDurationMs: 120000, minDurationMs: 90000, maxDurationMs: 180000 },
  { date: '2026-03-02', avgDurationMs: 115000, minDurationMs: 85000, maxDurationMs: 170000 },
];

const mockFlaky = [
  { testName: 'Login flaky test', flakyCount: 8, totalRuns: 42 },
  { testName: 'Upload timeout test', flakyCount: 3, totalRuns: 42 },
];

const mockRuns = {
  data: [
    {
      id: 'run-1',
      projectId: 'proj-1',
      name: null,
      status: 'passed',
      totalTests: 100,
      passedTests: 95,
      failedTests: 5,
      skippedTests: 0,
      flakyTests: 0,
      startedAt: '2026-01-01T00:00:00Z',
      finishedAt: '2026-01-01T00:03:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
};

const defaultApiResult = { data: null, loading: false, error: null, refetch: vi.fn() };

function setupFullMocks() {
  mockUseApi.mockImplementation((path: string) => {
    if (path?.includes('/analytics/summary')) return { ...defaultApiResult, data: mockSummary };
    if (path?.includes('/analytics/pass-rate-trend'))
      return { ...defaultApiResult, data: mockTrend };
    if (path?.includes('/analytics/duration-trend'))
      return { ...defaultApiResult, data: mockDuration };
    if (path?.includes('/analytics/flaky-tests')) return { ...defaultApiResult, data: mockFlaky };
    if (path === '/v1/runs') return { ...defaultApiResult, data: mockRuns };
    return defaultApiResult;
  });
}

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
  it('shows loading skeleton with 5 skeleton cards', () => {
    mockUseApi.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() });
    renderDashboard();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no runs', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path?.includes('/analytics/')) return defaultApiResult;
      return {
        ...defaultApiResult,
        data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      };
    });

    renderDashboard();
    expect(
      screen.getByText('No test runs found. Push some test results to get started.'),
    ).toBeInTheDocument();
  });

  it('renders 5 KPI cards with correct values', () => {
    setupFullMocks();
    renderDashboard();

    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();

    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();

    expect(screen.getByText('Failed Tests')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    expect(screen.getByText('Avg. Duration')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();

    expect(screen.getByText('Flaky Tests')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders period selector with 30d active by default', () => {
    setupFullMocks();
    renderDashboard();

    const buttons = screen.getAllByRole('button');
    const periodButtons = buttons.filter((b) => /^\d+d$/.test(b.textContent || ''));

    expect(periodButtons).toHaveLength(3);
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('14d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
  });

  it('changes period when clicking period buttons', async () => {
    setupFullMocks();
    renderDashboard();

    const user = userEvent.setup();
    await user.click(screen.getByText('7d'));

    // Verify useApi was called with days=7
    expect(mockUseApi).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/summary'),
      expect.objectContaining({ days: '7' }),
      expect.objectContaining({ toastId: 'api-error:analytics' }),
    );
  });

  it('renders pass rate chart with SVG', () => {
    setupFullMocks();
    renderDashboard();

    expect(screen.getByText('Pass Rate Trend')).toBeInTheDocument();
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders duration chart with SVG', () => {
    setupFullMocks();
    renderDashboard();

    expect(screen.getByText('Duration Trend')).toBeInTheDocument();
  });

  it('renders flaky tests list', () => {
    setupFullMocks();
    renderDashboard();

    expect(screen.getByText('Top Flaky Tests')).toBeInTheDocument();
    expect(screen.getByText('Login flaky test')).toBeInTheDocument();
    expect(screen.getByText('Upload timeout test')).toBeInTheDocument();
    expect(screen.getByText('8 flaky')).toBeInTheDocument();
    expect(screen.getByText('3 flaky')).toBeInTheDocument();
  });

  it('shows empty state for charts when no trend data', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path?.includes('/analytics/summary')) return { ...defaultApiResult, data: mockSummary };
      if (path?.includes('/analytics/pass-rate-trend')) return { ...defaultApiResult, data: [] };
      if (path?.includes('/analytics/duration-trend')) return { ...defaultApiResult, data: [] };
      if (path?.includes('/analytics/flaky-tests')) return { ...defaultApiResult, data: mockFlaky };
      if (path === '/v1/runs') return { ...defaultApiResult, data: mockRuns };
      return defaultApiResult;
    });

    renderDashboard();
    const noDataMessages = screen.getAllByText('No data for this period');
    expect(noDataMessages).toHaveLength(2);
  });

  it('shows empty state for flaky tests', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path?.includes('/analytics/summary')) return { ...defaultApiResult, data: mockSummary };
      if (path?.includes('/analytics/pass-rate-trend'))
        return { ...defaultApiResult, data: mockTrend };
      if (path?.includes('/analytics/duration-trend'))
        return { ...defaultApiResult, data: mockDuration };
      if (path?.includes('/analytics/flaky-tests')) return { ...defaultApiResult, data: [] };
      if (path === '/v1/runs') return { ...defaultApiResult, data: mockRuns };
      return defaultApiResult;
    });

    renderDashboard();
    expect(screen.getByText('No flaky tests detected')).toBeInTheDocument();
  });

  it('shows error message when analytics fails', () => {
    mockUseApi.mockImplementation((path: string) => {
      if (path?.includes('/analytics/summary'))
        return { ...defaultApiResult, error: 'Server error' };
      if (path === '/v1/runs') return { ...defaultApiResult, data: mockRuns };
      return defaultApiResult;
    });

    renderDashboard();
    expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
  });

  it('renders Recent Runs section', () => {
    setupFullMocks();
    renderDashboard();

    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
    expect(screen.getByText('95 / 100 passed')).toBeInTheDocument();
  });
});
