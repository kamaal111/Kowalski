import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { ForexLatestQuerySchema, ForexLatestResponseSchema } from '../schemas/latest';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { ErrorResponseSchema } from '@/schemas/errors';

const latestRoute = createRoute({
  method: 'get',
  path: '/latest',
  tags: [OPENAPI_TAG],
  summary: 'Get latest forex rates',
  description: 'Return the latest stored forex rates in the ForexKit-compatible response format.',
  request: {
    query: ForexLatestQuerySchema,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Latest forex rates retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ForexLatestResponseSchema,
        },
      },
    },
    [STATUS_CODES.NOT_FOUND]: {
      description: 'No forex rates are available for the resolved base currency',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default latestRoute;
