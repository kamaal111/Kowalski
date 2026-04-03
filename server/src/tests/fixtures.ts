import { test } from 'vitest';

import { createApp } from '@';
import { createTestDatabase, createTestUserAndSession } from './utils';
import { createTestRequestId, getLogsForRequestId, withRequestId } from './logs';

export const integrationTest = test
  .extend('_fixturesSetup', async ({}, { onCleanup }) => {
    const setup = await createTestDatabase();
    const db = setup.db;

    onCleanup(async () => {
      await setup.cleanup();
    });

    const app = createApp(db);

    const { token, userId } = await createTestUserAndSession(db);
    const sessionToken = token;

    return { app, sessionToken, db, userId, createTestRequestId, getLogsForRequestId, withRequestId };
  })
  .extend('db', ({ _fixturesSetup }) => _fixturesSetup.db)
  .extend('app', ({ _fixturesSetup }) => _fixturesSetup.app)
  .extend('sessionToken', ({ _fixturesSetup }) => _fixturesSetup.sessionToken)
  .extend('userId', ({ _fixturesSetup }) => _fixturesSetup.userId)
  .extend('createTestRequestId', ({ _fixturesSetup }) => _fixturesSetup.createTestRequestId)
  .extend('getLogsForRequestId', ({ _fixturesSetup }) => _fixturesSetup.getLogsForRequestId)
  .extend('withRequestId', ({ _fixturesSetup }) => _fixturesSetup.withRequestId);
