import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { buildTree, SuiteTree } from '@/shared/components/suite-tree';
import type { SuiteSummary } from '@/types/api';

const makeSuite = (id: string, name: string, parentSuiteId: string | null = null) =>
  ({ id, name, parentSuiteId, createdAt: '2026-01-01T00:00:00Z' }) as SuiteSummary;

const flatSuites: SuiteSummary[] = [
  makeSuite('s1', 'Unit Tests'),
  makeSuite('s2', 'Integration Tests'),
  makeSuite('s3', 'Auth Tests', 's1'),
  makeSuite('s4', 'DB Tests', 's1'),
  makeSuite('s5', 'Login Tests', 's3'),
];

describe('buildTree', () => {
  it('builds correct tree structure from flat array', () => {
    const tree = buildTree(flatSuites);

    expect(tree).toHaveLength(2);
    expect(tree[0].suite.name).toBe('Unit Tests');
    expect(tree[1].suite.name).toBe('Integration Tests');

    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].suite.name).toBe('Auth Tests');
    expect(tree[0].children[1].suite.name).toBe('DB Tests');

    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].suite.name).toBe('Login Tests');

    expect(tree[1].children).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('SuiteTree', () => {
  const defaultProps = {
    suites: flatSuites,
    selectedSuiteId: null,
    onSuiteSelect: vi.fn(),
    testCountBySuiteId: { s1: 10, s2: 5, s3: 3, s4: 7, s5: 2 },
  };

  it('renders "All Suites" and root suites', () => {
    render(<SuiteTree {...defaultProps} />);

    expect(screen.getByText('All Suites')).toBeInTheDocument();
    expect(screen.getByText('Unit Tests')).toBeInTheDocument();
    expect(screen.getByText('Integration Tests')).toBeInTheDocument();
  });

  it('does not show children when collapsed', () => {
    render(<SuiteTree {...defaultProps} />);

    expect(screen.queryByText('Auth Tests')).not.toBeInTheDocument();
    expect(screen.queryByText('DB Tests')).not.toBeInTheDocument();
  });

  it('expands children when chevron is clicked', async () => {
    const user = userEvent.setup();
    render(<SuiteTree {...defaultProps} />);

    const expandButtons = screen.getAllByLabelText(/^Expand /);
    await user.click(expandButtons[0]);

    expect(screen.getByText('Auth Tests')).toBeInTheDocument();
    expect(screen.getByText('DB Tests')).toBeInTheDocument();
  });

  it('collapses children when chevron is clicked again', async () => {
    const user = userEvent.setup();
    render(<SuiteTree {...defaultProps} />);

    const expandButton = screen.getAllByLabelText(/^Expand /)[0];
    await user.click(expandButton);
    expect(screen.getByText('Auth Tests')).toBeInTheDocument();

    const collapseButton = screen.getByLabelText(/^Collapse /);
    await user.click(collapseButton);
    expect(screen.queryByText('Auth Tests')).not.toBeInTheDocument();
  });

  it('calls onSuiteSelect with suite ID when suite name is clicked', async () => {
    const user = userEvent.setup();
    const onSuiteSelect = vi.fn();
    render(<SuiteTree {...defaultProps} onSuiteSelect={onSuiteSelect} />);

    await user.click(screen.getByText('Unit Tests'));
    expect(onSuiteSelect).toHaveBeenCalledWith('s1');
  });

  it('calls onSuiteSelect with null when "All Suites" is clicked', async () => {
    const user = userEvent.setup();
    const onSuiteSelect = vi.fn();
    render(<SuiteTree {...defaultProps} onSuiteSelect={onSuiteSelect} selectedSuiteId="s1" />);

    await user.click(screen.getByText('All Suites'));
    expect(onSuiteSelect).toHaveBeenCalledWith(null);
  });

  it('displays test count badges', () => {
    render(<SuiteTree {...defaultProps} />);

    const unitTestsRow = screen.getByText('Unit Tests').closest('div')!;
    expect(within(unitTestsRow).getByText('10')).toBeInTheDocument();

    const integrationRow = screen.getByText('Integration Tests').closest('div')!;
    expect(within(integrationRow).getByText('5')).toBeInTheDocument();
  });

  it('highlights selected suite', () => {
    render(<SuiteTree {...defaultProps} selectedSuiteId="s1" />);

    const unitTestsRow = screen.getByText('Unit Tests').closest('div[class]')!;
    expect(unitTestsRow.className).toContain('bg-accent');

    const allSuitesButton = screen.getByText('All Suites');
    const allSuitesClasses = allSuitesButton.className.split(' ');
    expect(allSuitesClasses).not.toContain('bg-accent');
  });

  it('expands deeply nested children', async () => {
    const user = userEvent.setup();
    render(<SuiteTree {...defaultProps} />);

    await user.click(screen.getAllByLabelText(/^Expand /)[0]);
    await user.click(screen.getAllByLabelText(/^Expand /)[0]);

    expect(screen.getByText('Login Tests')).toBeInTheDocument();
  });
});
