import { randomUUID } from 'crypto';

import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { AUTH_ROUTE_NAME } from '..';
import { SessionResponseSchema } from '@/auth/schemas/responses';
import { APP_API_BASE_PATH } from '@/constants/common';
import { integrationTest } from '@/tests/fixtures';
import { createTestUserAndSession } from '@/tests/utils';
import * as schema from '@/db/schema';

const SESSION_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/session` as const;
const PREFERENCES_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/preferences` as const;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Session preferred currency integration', () => {
  integrationTest('returns preferred_currency as null for a new user', async ({ app, db }) => {
    const { token } = await createTestUserAndSession(db);
    const response = await sendSessionRequest(app, { authToken: token });

    const session = SessionResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(session.user.preferred_currency).toBeNull();
  });

  integrationTest('returns preferred_currency when set in user preferences', async ({ app, db }) => {
    const { token, userId } = await createTestUserAndSession(db);

    await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });

    const response = await sendSessionRequest(app, { authToken: token });
    const session = SessionResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(session.user.preferred_currency).toBe('EUR');
  });

  integrationTest('returns preferred_currency via cookie-based session lookup', async ({ app }) => {
    const signUpPayload = {
      email: `test_${randomUUID()}@example.com`,
      password: 'password123',
      name: 'Cookie User',
    };

    const signUpResponse = await app.request(`${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/sign-up/email`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(signUpPayload),
    });

    expect(signUpResponse.status).toBe(201);
    const sessionToken = signUpResponse.headers.get('set-session-token');
    expect(sessionToken).toBeTruthy();

    const sessionResponse = await sendSessionRequest(app, { sessionToken: sessionToken ?? undefined });
    const session = SessionResponseSchema.parse(await sessionResponse.json());

    expect(session.user.preferred_currency).toBeNull();
  });
});

describe('PATCH /auth/preferences integration', () => {
  integrationTest(
    'updates the preferred currency and returns the refreshed session',
    async ({ app, db, getLogsForRequestId, withRequestId }) => {
      const { token, userId } = await createTestUserAndSession(db);
      const request = withRequestId({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
      const sessionBeforeUpdateResponse = await sendSessionRequest(app, { authToken: token });
      const sessionBeforeUpdate = SessionResponseSchema.parse(await sessionBeforeUpdateResponse.json());

      const response = await app.request(PREFERENCES_PATH, {
        method: 'PATCH',
        headers: request.headers,
        body: JSON.stringify({ preferred_currency: 'EUR' }),
      });

      expect(response.status).toBe(200);
      const body = SessionResponseSchema.parse(await response.json());
      expect(body.user.preferred_currency).toBe('EUR');
      expect(body.user.name).toBe(sessionBeforeUpdate.user.name);
      expect(body.user.email).toBe(sessionBeforeUpdate.user.email);
      expect(body.session.expires_at).toBe(sessionBeforeUpdate.session.expires_at);

      const rows = await db
        .select({ preferredCurrency: schema.userPreferences.preferredCurrency })
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, userId))
        .limit(1);
      expect(rows.at(0)?.preferredCurrency).toBe('EUR');

      const logs = getLogsForRequestId(request.requestId);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.preferences.updated',
            user_id: userId,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest('reflects the updated preference in subsequent session lookups', async ({ app, db }) => {
    const { token } = await createTestUserAndSession(db);

    await app.request(PREFERENCES_PATH, {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ preferred_currency: 'GBP' }),
    });

    const sessionResponse = await sendSessionRequest(app, { authToken: token });
    const session = SessionResponseSchema.parse(await sessionResponse.json());

    expect(session.user.preferred_currency).toBe('GBP');
  });

  integrationTest('rejects a currency code that is not exactly 3 characters', async ({ app, db }) => {
    const { token } = await createTestUserAndSession(db);

    const tooShort = await app.request(PREFERENCES_PATH, {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ preferred_currency: 'US' }),
    });
    expect(tooShort.status).toBe(400);

    const tooLong = await app.request(PREFERENCES_PATH, {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ preferred_currency: 'USDX' }),
    });
    expect(tooLong.status).toBe(400);
  });

  integrationTest('rejects an empty payload', async ({ app, db }) => {
    const { token } = await createTestUserAndSession(db);

    const response = await app.request(PREFERENCES_PATH, {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  integrationTest('normalises a lowercase currency code to uppercase', async ({ app, db }) => {
    const { token } = await createTestUserAndSession(db);

    const response = await app.request(PREFERENCES_PATH, {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ preferred_currency: 'eur' }),
    });

    expect(response.status).toBe(200);
    const body = SessionResponseSchema.parse(await response.json());
    expect(body.user.preferred_currency).toBe('EUR');
  });
});

function sendSessionRequest(app: AppRequestClient, options: { authToken?: string; sessionToken?: string }) {
  return app.request(SESSION_PATH, {
    method: 'GET',
    headers: createSessionRequestHeaders(options),
  });
}

function createSessionRequestHeaders(options: { authToken?: string; sessionToken?: string }) {
  const headers = new Headers();

  if (options.authToken != null) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }

  if (options.sessionToken != null) {
    headers.set('Cookie', `better-auth.session_token=${options.sessionToken}`);
  }

  return headers;
}
