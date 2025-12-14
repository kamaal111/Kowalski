import { createRoute } from '@hono/zod-openapi';

import { SessionResponseSchema } from '../schemas/responses.js';
import { OPENAPI_TAG } from '../constants.js';
import { requireLoggedInSessionMiddleware } from '../middleware.js';
import { ErrorResponseSchema } from '../../schemas/errors.js';
import { AuthenticationHeaders } from '../../schemas/headers.js';

const sessionRoute = createRoute({
  method: 'get',
  path: '/session',
  tags: [OPENAPI_TAG],
  summary: 'Get session',
  middleware: [requireLoggedInSessionMiddleware],
  description:
    'Get the current user session information. Can authenticate via either Authorization header (JWT bearer token) or session cookie.',
  request: {
    headers: AuthenticationHeaders.partial(),
  },
  responses: {
    200: {
      description: 'Session retrieved successfully',
      content: {
        'application/json': {
          schema: SessionResponseSchema,
        },
      },
    },
    404: {
      description: 'Session not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default sessionRoute;
