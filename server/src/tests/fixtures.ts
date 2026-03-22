import { test } from 'vitest';

import { createApp } from '@/index.js';
import { createTestDatabase, createTestUserAndSession } from './utils.js';

export const integrationTest = test
  .extend('_fixturesSetup', async ({}, { onCleanup }) => {
    const setup = await createTestDatabase();
    const db = setup.db;

    onCleanup(async () => {
      await setup.cleanup();
    });

    const app = createApp(db);

    const { token } = await createTestUserAndSession(db);
    const sessionToken = token;

    return { app, sessionToken, db };
  })
  .extend('db', ({ _fixturesSetup }) => _fixturesSetup.db)
  .extend('app', ({ _fixturesSetup }) => _fixturesSetup.app)
  .extend('sessionToken', ({ _fixturesSetup }) => _fixturesSetup.sessionToken);
