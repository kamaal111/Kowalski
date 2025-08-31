import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';

import { AuthResponseSchema, ErrorResponseSchema } from '../schemas/responses.js';

const EmailPasswordSignInSchema = z.object({
  email: z.email().openapi({ description: 'User email address' }),
  password: z.string().min(6).openapi({ description: 'User password (minimum 6 characters)' }),
  callbackURL: z.url().optional().openapi({ description: 'URL to redirect to after sign in' }),
});

const signInRoute = createRoute({
  method: 'post',
  path: '/sign-in/email',
  tags: ['Authentication'],
  summary: 'Sign in with email and password',
  description: 'Authenticate a user with email and password credentials',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EmailPasswordSignInSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Sign in successful',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid credentials or request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default signInRoute;
