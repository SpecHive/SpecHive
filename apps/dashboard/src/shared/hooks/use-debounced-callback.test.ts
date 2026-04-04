import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedCallback } from './use-debounced-callback';

const DELAY = 300;

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire callback before delay elapses', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, DELAY));

    act(() => {
      result.current('arg');
    });

    vi.advanceTimersByTime(DELAY - 1);

    expect(callback).not.toHaveBeenCalled();
  });

  it('fires callback once after the full delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, DELAY));

    act(() => {
      result.current('arg');
    });

    act(() => {
      vi.advanceTimersByTime(DELAY);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on subsequent calls so only the last one fires', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, DELAY));

    act(() => {
      result.current('first');
    });

    // Advance partway through the delay and call again — resets the timer.
    vi.advanceTimersByTime(DELAY - 1);

    act(() => {
      result.current('second');
    });

    // The first timer would have fired here if it hadn't been cleared.
    act(() => {
      vi.advanceTimersByTime(DELAY);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('second');
  });

  it('passes the correct arguments to the callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, DELAY));

    act(() => {
      result.current('hello', 42);
    });

    act(() => {
      vi.advanceTimersByTime(DELAY);
    });

    expect(callback).toHaveBeenCalledWith('hello', 42);
  });

  it('does not fire callback after unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, DELAY));

    act(() => {
      result.current('arg');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(DELAY);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('invokes the latest callback ref when the callback changes between calls', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const { result, rerender } = renderHook(
      ({ cb }: { cb: (...args: unknown[]) => void }) => useDebouncedCallback(cb, DELAY),
      { initialProps: { cb: firstCallback } },
    );

    // Schedule a call with the first callback in scope.
    act(() => {
      result.current('arg');
    });

    // Swap the callback before the timer fires.
    rerender({ cb: secondCallback });

    act(() => {
      vi.advanceTimersByTime(DELAY);
    });

    // The hook always reads callbackRef.current, so the latest version fires.
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledOnce();
  });
});
