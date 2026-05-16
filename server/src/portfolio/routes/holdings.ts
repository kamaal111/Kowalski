import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { AuthenticationHeaders } from '@/schemas/headers';
import { ErrorResponseSchema } from '@/schemas/errors';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { PortfolioHoldingsResponseSchema } from '../schemas/responses';

const holdingsRoute = createRoute({
  method: 'get',
  path: '/holdings',
  tags: [OPENAPI_TAG],
  summary: 'Get portfolio holdings',
  description: 'Return portfolio net worth and aggregated holdings for the signed-in user default portfolio.',
  request: {
    headers: AuthenticationHeaders,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio holdings retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: PortfolioHoldingsResponseSchema,
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
      description: 'Portfolio holdings could not be retrieved',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default holdingsRoute;
