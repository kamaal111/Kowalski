import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { APP_API_BASE_PATH } from '../../constants/common.ts';
import { session } from '../../db/schema/better-auth.ts';
import { integrationTest } from '../../tests/fixtures.ts';
import { AUTH_ROUTE_NAME } from '../index.ts';

const AUTH_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}`;

describe('Sign-out integration', () => {
  integrationTest('invalidates the signed-in session and prevents further token issuance', async ({ app, db }) => {
    const signUpResponse = await app.request(`${AUTH_PATH}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'kowalski://' },
      body: JSON.stringify({ name: 'Sign Out User', email: `${randomUUID()}@example.com`, password: 'password123' }),
    });

    expect(signUpResponse.status).toBe(201);
    const sessionToken = signUpResponse.headers.get('set-session-token');
    expect(sessionToken).toBeTypeOf('string');
    expect(sessionToken).not.toBeNull();
    const headers = { Authorization: `Bearer ${sessionToken}`, Origin: 'kowalski://' };

    const before = await app.request(`${AUTH_PATH}/session`, { headers });
    expect(before.status).toBe(200);

    const response = await app.request(`${AUTH_PATH}/sign-out`, { method: 'POST', headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});

    const after = await app.request(`${AUTH_PATH}/session`, { headers });
    expect(after.status).toBe(401);
    const tokenResponse = await app.request(`${AUTH_PATH}/token`, { headers });
    expect(tokenResponse.status).toBe(401);

    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.token, String(sessionToken)));

    expect(sessions).toHaveLength(0);
  });
});
