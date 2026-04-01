import type { Mock } from 'vitest';
import { vi } from 'vitest';

export interface MockInsertChain {
  insert: Mock;
  values: Mock;
  onConflictDoNothing: Mock;
  onConflictDoUpdate: Mock;
  returning: Mock;
}

export interface MockSelectChain {
  select: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  limit: Mock;
}

export interface MockUpdateChain {
  update: Mock;
  set: Mock;
  where: Mock;
  returning: Mock;
}

/** Create a chainable mock for Drizzle insert().values().onConflict*().returning() */
export function createMockInsertChain(): MockInsertChain {
  const returning = vi.fn().mockResolvedValue([]);
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing, onConflictDoUpdate, returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, onConflictDoNothing, onConflictDoUpdate, returning };
}

/** Create a chainable mock for Drizzle select().from().where().orderBy().limit() */
export function createMockSelectChain(returnValue: unknown[] = []): MockSelectChain {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy, limit });
  const from = vi.fn().mockReturnValue({ where, orderBy, limit });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where, orderBy, limit };
}

/** Create a chainable mock for Drizzle update().set().where().returning() */
export function createMockUpdateChain(returnValue: unknown[] = []): MockUpdateChain {
  const returning = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where, returning });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where, returning };
}

export interface MockDb {
  db: { insert: Mock; select: Mock; update: Mock };
  tx: { insert: Mock; select: Mock; update: Mock };
  insertChain: MockInsertChain;
  selectChain: MockSelectChain;
  updateChain: MockUpdateChain;
  resetMocks: () => void;
}

/** Combine all chain mocks into a single mock DB object. */
export function createMockDb(): MockDb {
  const insertChain = createMockInsertChain();
  const selectChain = createMockSelectChain();
  const updateChain = createMockUpdateChain();

  const db = {
    insert: insertChain.insert,
    select: selectChain.select,
    update: updateChain.update,
  };

  function resetMocks() {
    for (const chain of [insertChain, selectChain, updateChain]) {
      for (const fn of Object.values(chain)) {
        (fn as Mock).mockClear();
      }
    }
  }

  return { db, tx: db, insertChain, selectChain, updateChain, resetMocks };
}
