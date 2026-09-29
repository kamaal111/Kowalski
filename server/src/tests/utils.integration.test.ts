import { Client } from 'pg';
import { expect, test } from 'vitest';

import { createTestDatabase } from './utils.ts';

test('database cleanup closes every pooled connection before dropping the database', async () => {
  const setup = await createTestDatabase();
  const pool = setup.db.$client;
  const clients = await Promise.all([pool.connect(), pool.connect()]);
  const closedClients: number[] = [];
  const connectionErrors: Error[] = [];

  clients.forEach((client, index) => {
    client.once('end', () => closedClients.push(index));
    client.on('error', error => connectionErrors.push(error));
    client.release();
  });

  await setup.cleanup();

  expect(closedClients.toSorted()).toEqual([0, 1]);
  expect(connectionErrors).toEqual([]);

  const observer = new Client({ connectionString: process.env.DATABASE_URL });
  await observer.connect();

  try {
    const databaseName = new URL(setup.connectionString).pathname.slice(1);
    const result = await observer.query('SELECT datname FROM pg_database WHERE datname = $1', [databaseName]);

    expect(result.rows).toEqual([]);
    expect((await observer.query('SELECT 1 AS value')).rows).toEqual([{ value: 1 }]);
  } finally {
    await observer.end();
  }
});
