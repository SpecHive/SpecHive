import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Pagination } from '@/components/ui/pagination';

describe('Pagination', () => {
  const baseMeta = { page: 2, pageSize: 20, total: 100, totalPages: 5 };

  it('renders page info and navigation buttons', () => {
    render(<Pagination meta={baseMeta} onPageChange={vi.fn()} />);

    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('returns null when totalPages <= 1', () => {
    const { container } = render(
      <Pagination meta={{ ...baseMeta, totalPages: 1 }} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('disables Previous on first page', () => {
    render(<Pagination meta={{ ...baseMeta, page: 1 }} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(<Pagination meta={{ ...baseMeta, page: 5 }} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPageChange with correct page on Previous click', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={baseMeta} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange with correct page on Next click', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={baseMeta} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders page size selector when onPageSizeChange is provided', () => {
    render(
      <Pagination
        meta={baseMeta}
        onPageChange={vi.fn()}
        pageSize={20}
        onPageSizeChange={vi.fn()}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Page size' });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('20');
  });

  it('does not render page size selector when onPageSizeChange is not provided', () => {
    render(<Pagination meta={baseMeta} onPageChange={vi.fn()} />);
    expect(screen.queryByRole('combobox', { name: 'Page size' })).not.toBeInTheDocument();
  });

  it('calls onPageSizeChange when page size is changed', async () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        meta={baseMeta}
        onPageChange={vi.fn()}
        pageSize={20}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Page size' }), '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
