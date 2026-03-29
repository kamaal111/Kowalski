import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { requireLoggedInSessionMiddleware } from '@/auth/middleware';
import { AuthenticationHeaders } from '@/schemas/headers';
import { ErrorResponseSchema } from '@/schemas/errors';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { ListEntriesResponseSchema } from '../schemas/responses';

const listEntriesRoute = createRoute({
  method: 'get',
  path: '/entries',
  tags: [OPENAPI_TAG],
  summary: 'List portfolio entries',
  middleware: [requireLoggedInSessionMiddleware],
  description: 'List portfolio entries for the signed-in user default portfolio.',
  request: {
    headers: AuthenticationHeaders,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio entries retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ListEntriesResponseSchema,
        },
      },
    },
    [STATUS_CODES.UNAUTHORIZED]: {
      description: 'Authentication failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
    [STATUS_CODES.NOT_FOUND]: {
      description: 'Session not found',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
    [STATUS_CODES.INTERNAL_SERVER_ERROR]: {
      description: 'Portfolio entries could not be retrieved',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default listEntriesRoute;
