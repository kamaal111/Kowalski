import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';

import { ErrorResponseSchema, SessionResponseSchema } from '../schemas/responses.js';

const sessionRoute = createRoute({
  method: 'get',
  path: '/session',
  tags: ['Authentication'],
  summary: 'Get session',
  description: 'Get the current user session information',
  request: {
    headers: z.object({
      authorization: z.string().openapi({
        description: 'Bearer token for authentication',
        example: 'Bearer f21wcpz7Aokmlh2MB632MZpTgfruPc62',
      }),
    }),
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
