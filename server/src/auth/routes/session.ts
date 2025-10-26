import { createRoute } from '@hono/zod-openapi';

import { ErrorResponseSchema, SessionResponseSchema } from '../schemas/responses.js';
import { OPENAPI_TAG } from '../constants.js';
import { AuthenticationHeaders } from '../schemas/headers.js';

const sessionRoute = createRoute({
  method: 'get',
  path: '/session',
  tags: [OPENAPI_TAG],
  summary: 'Get session',
  description: 'Get the current user session information',
  request: {
    headers: AuthenticationHeaders,
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
