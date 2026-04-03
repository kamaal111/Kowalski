import { describe, expect } from 'vitest';
import type z from 'zod';

import { AUTH_ROUTE_NAME } from '..';
import { APP_API_BASE_PATH } from '@/constants/common';
import { ValidationErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';

const SIGN_UP_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/sign-up/email`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Sign-up validation integration', () => {
  integrationTest(
    'returns validation details for an invalid email',
    async ({ app, getLogsForRequestId, withRequestId }) => {
      const payload = {
        ...createValidSignUpPayload(),
        email: 'invalid-email',
        password: 'SuperSecret123',
        name: 'Private Person',
      };
      const { headers, requestId } = withRequestId({ 'Content-Type': 'application/json' });
      const response = await sendSignUpRequest(app, payload, headers);

      const body = await expectValidationErrorResponse(response);
      const logs = getLogsForRequestId(requestId);
      const serializedLogs = JSON.stringify(logs);

      expect(body.message).toBe('Invalid payload');
      expect(body.code).toBe('INVALID_PAYLOAD');
      expectValidationIssueForField(body, 'email');
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.validation.failed',
            request_id: requestId,
            status_code: 400,
            validation_issue_count: 1,
            validation_issue_paths: ['email'],
          }),
        ]),
      );
      expect(serializedLogs).not.toContain(payload.email);
      expect(serializedLogs).not.toContain(payload.password);
      expect(serializedLogs).not.toContain(payload.name);
    },
  );

  integrationTest('returns validation details for a short password', async ({ app }) => {
    const response = await sendSignUpRequest(app, {
      ...createValidSignUpPayload(),
      password: 'short',
    });

    const body = await expectValidationErrorResponse(response);

    expectValidationIssueForField(body, 'password');
  });

  integrationTest('returns validation details for a single-word name', async ({ app }) => {
    const response = await sendSignUpRequest(app, {
      ...createValidSignUpPayload(),
      name: 'Prince',
    });

    const body = await expectValidationErrorResponse(response);

    expectValidationIssueForField(body, 'name');
  });
});

function createValidSignUpPayload() {
  return {
    email: `test_${crypto.randomUUID()}@example.com`,
    password: 'password123',
    name: 'Test User',
  };
}

async function sendSignUpRequest(app: AppRequestClient, payload: unknown, headers?: Headers) {
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

async function expectValidationErrorResponse(response: Response) {
  expect(response.status).toBe(400);

  return ValidationErrorResponseSchema.parse(await response.json());
}

function expectValidationIssueForField(body: z.infer<typeof ValidationErrorResponseSchema>, fieldName: string) {
  const hasMatchingIssue = body.context?.validations.some(issue => issue.path.includes(fieldName)) ?? false;

  expect(hasMatchingIssue).toBe(true);
}
