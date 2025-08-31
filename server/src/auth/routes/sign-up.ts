import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';
import { AuthResponseSchema, ErrorResponseSchema } from '../schemas/responses.js';

const EmailPasswordSignUpSchema = z.object({
  email: z.email().min(1).openapi({ description: 'User email address' }),
  password: z.string().min(8).max(128).openapi({ description: 'User password (minimum 8 characters)' }),
  name: z.string().openapi({ description: 'User display name' }),
  callbackURL: z.url().optional().openapi({ description: 'URL to redirect to after sign up' }),
});

const signUpRoute = createRoute({
  method: 'post',
  path: '/sign-up/email',
  tags: ['Authentication'],
  summary: 'Sign up with email and password',
  description: 'Create a new user account with email and password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EmailPasswordSignUpSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Account created successfully',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request or email already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Email already registered',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default signUpRoute;
