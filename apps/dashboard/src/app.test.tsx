import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';
import { SseProvider } from '@/contexts/sse-context';
import { DashboardPage } from '@/features/dashboard/dashboard-page';

vi.mock('@/shared/hooks/use-api', () => ({
  useApi: vi.fn().mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SseProvider>
          <DashboardPage />
        </SseProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('renders the page heading', () => {
    renderDashboard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders the recent runs section', () => {
    renderDashboard();
    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    renderDashboard();
    expect(
      screen.getByText('No test runs found. Push some test results to get started.'),
    ).toBeInTheDocument();
  });
});
