import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { AuthenticationHeaders } from '@/schemas/headers';
import { ErrorResponseSchema } from '@/schemas/errors';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { PortfolioHoldingsPreflightResponseSchema } from '../schemas/responses';

const holdingsPreflightRoute = createRoute({
  method: 'get',
  path: '/holdings/preflight',
  tags: [OPENAPI_TAG],
  summary: 'Check portfolio holdings price readiness',
  description: 'Return whether daily prices are ready before fetching portfolio holdings.',
  request: {
    headers: AuthenticationHeaders,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio holdings price readiness retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: PortfolioHoldingsPreflightResponseSchema,
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
      description: 'Portfolio holdings preflight could not be retrieved',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default holdingsPreflightRoute;
