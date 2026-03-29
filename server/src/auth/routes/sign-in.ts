import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';

import { AuthResponseSchema } from '../schemas/responses';
import { STATUS_CODES } from '../../constants/http';
import { OPENAPI_TAG } from '../constants';
import { MIME_TYPES } from '../../constants/request';
import { TokenHeaders } from '../schemas/headers';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '../../schemas/errors';

const EmailPasswordSignInSchema = z
  .object({
    email: z.email().openapi({
      description: 'User email address',
      example: 'user@example.com',
    }),
    password: z.string().min(6).openapi({
      description: 'User password (minimum 6 characters)',
      example: 'securePassword123',
    }),
    callbackURL: z.url().optional().openapi({
      description:
        'Optional URL to redirect to after successful sign in. If not provided, the default redirect will be used.',
      example: 'https://app.example.com/dashboard',
    }),
  })
  .openapi('EmailPasswordSignIn', {
    title: 'Email Password Sign In Request',
    description: 'Request payload for signing in with email and password credentials',
    example: {
      email: 'user@example.com',
      password: 'securePassword123',
      callbackURL: 'https://app.example.com/dashboard',
    },
  });

const signInRoute = createRoute({
  method: 'post',
  path: '/sign-in/email',
  tags: [OPENAPI_TAG],
  summary: 'Sign in with email and password',
  description: 'Authenticate a user with email and password credentials',
  request: {
    body: {
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: EmailPasswordSignInSchema },
      },
    },
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Sign in successful',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: AuthResponseSchema },
      },
      headers: TokenHeaders,
    },
    [STATUS_CODES.BAD_REQUEST]: {
      description: 'Invalid credentials or request',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: ValidationErrorResponseSchema },
      },
    },
    [STATUS_CODES.UNAUTHORIZED]: {
      description: 'Authentication failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: ErrorResponseSchema },
      },
    },
  },
});

export default signInRoute;
