import { describe, expect } from 'vitest';
import type { z } from 'zod';

import { AUTH_ROUTE_NAME } from '..';
import { APP_API_BASE_PATH } from '@/constants/common';
import { ValidationErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';

const SIGN_IN_PATH = `${APP_API_BASE_PATH}${AUTH_ROUTE_NAME}/sign-in/email`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Sign-in validation integration', () => {
  integrationTest('returns validation details for an invalid email', async ({ app }) => {
    const response = await sendSignInRequest(app, {
      email: 'invalid-email',
      password: 'password123',
    });

    const body = await expectValidationErrorResponse(response);

    expect(body.message).toBe('Invalid payload');
    expect(body.code).toBe('INVALID_PAYLOAD');
    expectValidationIssueForField(body, 'email');
  });

  integrationTest('returns validation details for a short password', async ({ app }) => {
    const response = await sendSignInRequest(app, {
      email: 'test@example.com',
      password: '12345',
    });

    const body = await expectValidationErrorResponse(response);

    expectValidationIssueForField(body, 'password');
  });
});

async function sendSignInRequest(app: AppRequestClient, payload: unknown) {
  return app.request(SIGN_IN_PATH, {
    method: 'POST',
    headers: new Headers({
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
