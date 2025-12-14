import { randomUUID } from 'crypto';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, Client } from 'pg';
import { z } from 'zod';

import type { Database } from '../db/index.js';
import { createAuth } from '../auth/index.js';
import schema from '@/db/schema/index.js';

const BASE_DATABASE_URL = process.env.DATABASE_URL;

if (!BASE_DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const createTestDatabase = async (): Promise<{
  db: Database;
  connectionString: string;
  cleanup: () => Promise<void>;
}> => {
  const client = new Client({ connectionString: BASE_DATABASE_URL });
  await client.connect();
  const dbName = `test_db_${randomUUID().replace(/-/g, '_')}`;
  await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();

  const testDbUrl = BASE_DATABASE_URL.replace(/\/[^/]+$/, `/${dbName}`);
  const pool = new Pool({ connectionString: testDbUrl });
  const testDb = drizzle(pool, { schema });

  await migrate(testDb, { migrationsFolder: './drizzle' });

  const cleanup = async () => {
    await pool.end();
    const dropClient = new Client({ connectionString: BASE_DATABASE_URL });
    await dropClient.connect();
    await dropClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbName}'
      AND pid <> pg_backend_pid();
    `);
    await dropClient.query(`DROP DATABASE ${dbName}`);
    await dropClient.end();
  };

  return { db: testDb, connectionString: testDbUrl, cleanup };
};

export const createTestUserAndSession = async (db: Database) => {
  const auth = createAuth(db);
  const res = await auth.api.signUpEmail({
    body: {
      email: `test_${randomUUID()}@example.com`,
      password: 'password123',
      name: 'Test User',
    },
  });
  if (!res) {
    throw new Error('Failed to create test user');
  }

  const responseSchema = z.object({
    token: z.string().optional(),
    session: z.object({ token: z.string() }).optional(),
  });
  const parsed = responseSchema.safeParse(res);
  if (!parsed.success) {
    throw new Error(`Failed to parse sign up response: ${JSON.stringify(z.treeifyError(parsed.error))}`);
  }

  const token = parsed.data.token ?? parsed.data.session?.token;
  if (!token) {
    throw new Error('Failed to get token from sign up response');
  }

  return { ...res, token };
};
