import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SortableHeader } from '@/shared/components/ui/sortable-header';

function renderHeader(props: Partial<React.ComponentProps<typeof SortableHeader>> = {}) {
  return render(
    <table>
      <thead>
        <tr>
          <SortableHeader
            label="Name"
            column="name"
            currentSort={null}
            currentDirection={null}
            onSort={vi.fn()}
            {...props}
          />
        </tr>
      </thead>
    </table>,
  );
}

describe('SortableHeader', () => {
  it('renders label', () => {
    renderHeader();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('cycles null → asc on first click', async () => {
    const onSort = vi.fn();
    renderHeader({ onSort });

    await userEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('cycles asc → desc on second click', async () => {
    const onSort = vi.fn();
    renderHeader({ currentSort: 'name', currentDirection: 'asc', onSort });

    await userEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('cycles desc → null on third click', async () => {
    const onSort = vi.fn();
    renderHeader({ currentSort: 'name', currentDirection: 'desc', onSort });

    await userEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', null);
  });

  it('sets aria-sort ascending when active asc', () => {
    renderHeader({ currentSort: 'name', currentDirection: 'asc' });
    const th = screen.getByText('Name').closest('th');
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sets aria-sort descending when active desc', () => {
    renderHeader({ currentSort: 'name', currentDirection: 'desc' });
    const th = screen.getByText('Name').closest('th');
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  it('has aria-sort="none" when not active', () => {
    renderHeader({ currentSort: 'other', currentDirection: 'asc' });
    const th = screen.getByText('Name').closest('th');
    expect(th).toHaveAttribute('aria-sort', 'none');
  });
});
