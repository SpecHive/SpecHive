import { timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

export function uuidv7PK<T extends string = string>() {
  return uuid('id')
    .$type<T>()
    .primaryKey()
    .$defaultFn(() => uuidv7() as T);
}

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
