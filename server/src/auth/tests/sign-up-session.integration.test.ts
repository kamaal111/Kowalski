import { randomUUID } from 'crypto';

import { z } from 'zod';
import { describe, expect } from 'vitest';

import { AUTH_ROUTE_NAME } from '..';
import env from '@/api/env';
import { APP_API_BASE_PATH, ONE_DAY_IN_SECONDS } from '@/constants/common';
import { SessionResponseSchema } from '@/auth/schemas/responses';
import { integrationTest } from '@/tests/fixtures';
import { createTestUserAndSession } from '@/tests/utils';

const SIGN_UP_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/sign-up/email`;
const SESSION_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/session`;

const AuthResponseBodySchema = z.object({
  token: z.string().min(1),
});

const SignUpTokenHeadersSchema = z.object({
  'set-auth-token': z.string().min(1),
  'set-auth-token-expiry': z.string().min(1),
  'set-session-token': z.string().min(1),
  'set-session-update-age': z.string().min(1),
});

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Sign-up session integration', () => {
  integrationTest(
    'returns auth and session headers when a user signs up',
    async ({ app, getLogsForRequestId, withRequestId }) => {
      const payload = createValidSignUpPayload();
      const { headers, requestId } = withRequestId({ 'Content-Type': 'application/json' });
      const response = await sendSignUpRequest(app, payload, headers);

      const { headers: responseHeaders } = await expectSuccessfulSignUpResponse(response);
      const logs = getLogsForRequestId(requestId);

      expect(Number(responseHeaders['set-auth-token-expiry'])).toBeGreaterThan(0);
      expect(Number(responseHeaders['set-session-update-age'])).toBe(
        ONE_DAY_IN_SECONDS * env.BETTER_AUTH_SESSION_UPDATE_AGE_DAYS,
      );
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.sign_up.succeeded',
            request_id: requestId,
            route: SIGN_UP_PATH,
            component: 'auth',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'retrieves the current session with the session cookie issued at sign up',
    async ({ app, getLogsForRequestId, withRequestId }) => {
      const payload = createValidSignUpPayload();
      const signUpResponse = await sendSignUpRequest(app, payload);
      const { headers } = await expectSuccessfulSignUpResponse(signUpResponse);

      const request = withRequestId({
        Cookie: `better-auth.session_token=${headers['set-session-token']}`,
      });
      const sessionResponse = await sendSessionRequest(app, {
        headers: request.headers,
      });

      const session = await expectSuccessfulSessionResponse(sessionResponse);
      const logs = getLogsForRequestId(request.requestId);

      expect(session).toMatchObject({
        user: {
          name: payload.name,
          email: payload.email,
          email_verified: false,
        },
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.lookup',
            request_id: request.requestId,
            component: 'auth',
            outcome: 'success',
          }),
          expect.objectContaining({
            event: 'request.completed',
            request_id: request.requestId,
            route: SESSION_PATH,
            user_id: session.user.id,
          }),
        ]),
      );
    },
  );

  integrationTest('retrieves the current session for a helper-created authorization token', async ({ app, db }) => {
    const { token } = await createTestUserAndSession(db);
    const response = await sendSessionRequest(app, { authToken: token });

    const session = await expectSuccessfulSessionResponse(response);

    expect(session.user.id).toBeTruthy();
  });
});

function createValidSignUpPayload() {
  return {
    email: `test_${randomUUID()}@example.com`,
    password: 'password123',
    name: 'Test User',
  };
}

async function sendSignUpRequest(
  app: AppRequestClient,
  payload: ReturnType<typeof createValidSignUpPayload>,
  headers?: Headers,
) {
  return app.request(SIGN_UP_PATH, {
    method: 'POST',
    headers:
      headers ??
      new Headers({
        'Content-Type': 'application/json',
      }),
    body: JSON.stringify(payload),
  });
}

async function sendSessionRequest(
  app: AppRequestClient,
  options: {
    authToken?: string;
    headers?: Headers;
    sessionToken?: string;
  },
) {
  return app.request(SESSION_PATH, {
    method: 'GET',
    headers: options.headers ?? createSessionRequestHeaders(options),
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

async function expectSuccessfulSignUpResponse(response: Response) {
  expect(response.status).toBe(201);

  const body = AuthResponseBodySchema.parse(await response.json());
  const headers = SignUpTokenHeadersSchema.parse({
    'set-auth-token': response.headers.get('set-auth-token'),
    'set-auth-token-expiry': response.headers.get('set-auth-token-expiry'),
    'set-session-token': response.headers.get('set-session-token'),
    'set-session-update-age': response.headers.get('set-session-update-age'),
  });

  return { body, headers };
}

async function expectSuccessfulSessionResponse(response: Response) {
  expect(response.status).toBe(200);

  return SessionResponseSchema.parse(await response.json());
}
