/* eslint-disable no-console */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hash } from 'argon2';
import { sql } from 'drizzle-orm';

import { createDbConnection, getRawClient } from './connection.js';

async function resetPassword(dbUrl: string, email: string, password?: string) {
  const newPassword = password ?? randomBytes(12).toString('base64url');
  const db = createDbConnection(dbUrl);

  try {
    const passwordHash = await hash(newPassword, { type: 2 });

    const result = await db.execute<{ id: string }>(
      sql`UPDATE users SET password_hash = ${passwordHash} WHERE email = ${email} RETURNING id`,
    );

    if (result.length === 0) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const userId = result[0]!.id;

    await db.execute(sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}::uuid`);

    // Print password to stdout for scripting, messages to stderr
    console.log(newPassword);
    console.error(`Password reset successfully for ${email}`);
  } finally {
    const client = getRawClient(db);
    await client.end();
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: pnpm db:reset-password <email> [new-password]');
    process.exit(1);
  }

  const password = process.argv[3];
  const url = process.env['SEED_DATABASE_URL'];
  if (!url) {
    console.error('SEED_DATABASE_URL is required (must use superuser role to bypass RLS)');
    process.exit(1);
  }

  resetPassword(url, email, password).catch((err) => {
    console.error('Password reset failed:', err);
    process.exit(1);
  });
}
