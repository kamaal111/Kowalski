import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';
import { ErrorResponseSchema, AuthResponseSchema } from '../schemas/responses.js';
import { MIME_TYPES } from '../../constants/request.js';
import { OPENAPI_TAG } from '../constants.js';
import { STATUS_CODES } from '../../constants/http.js';

const EmailPasswordSignUpSchema = z
  .object({
    email: z.email().min(1).openapi({
      description: 'User email address',
      example: 'john.doe@example.com',
    }),
    password: z.string().min(8).max(128).openapi({
      description: 'User password (minimum 8 characters)',
      example: 'SecurePassword123!',
    }),
    name: z.string().openapi({
      description: 'User display name',
      example: 'John Doe',
    }),
    callbackURL: z.url().optional().openapi({
      description: 'URL to redirect to after sign up',
      example: 'https://example.com/dashboard',
    }),
  })
  .openapi('EmailPasswordSignUp', {
    title: 'Email Password Sign Up',
    description: 'Request body for signing up with email and password',
    example: {
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      name: 'John Doe',
      callbackURL: 'https://example.com/dashboard',
    },
  });

const signUpRoute = createRoute({
  method: 'post',
  path: '/sign-up/email',
  tags: [OPENAPI_TAG],
  summary: 'Sign up with email and password',
  description: 'Create a new user account with email and password',
  request: {
    body: {
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: EmailPasswordSignUpSchema },
      },
    },
  },
  responses: {
    [STATUS_CODES.CREATED]: {
      description: 'Account created successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: AuthResponseSchema },
      },
    },
    [STATUS_CODES.BAD_REQUEST]: {
      description: 'Invalid request or email already exists',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: ErrorResponseSchema },
      },
    },
    [STATUS_CODES.CONFLICT]: {
      description: 'Email already registered',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: { schema: ErrorResponseSchema },
      },
    },
  },
});

export default signUpRoute;
