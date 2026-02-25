import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { DashboardPage } from '@/pages/dashboard';

describe('DashboardPage', () => {
  it('renders the page heading', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders all four stat cards', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('Failed Tests')).toBeInTheDocument();
    expect(screen.getByText('Avg. Duration')).toBeInTheDocument();
  });

  it('renders the recent runs section', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
  });

  it('renders stat values', () => {
    render(<DashboardPage />);
    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('94.2%')).toBeInTheDocument();
  });
});
