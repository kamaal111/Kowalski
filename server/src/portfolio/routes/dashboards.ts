import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { PortfolioDashboardsQuerySchema } from '../schemas/queries';
import { PortfolioDashboardsResponseSchema } from '../schemas/responses';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '@/schemas/errors';
import { AuthenticationHeaders } from '@/schemas/headers';

const dashboardsRoute = createRoute({
  method: 'get',
  path: '/dashboards',
  tags: [OPENAPI_TAG],
  summary: 'Get portfolio dashboards',
  description: 'Return sparse dashboard data for the signed-in user default portfolio.',
  request: {
    headers: AuthenticationHeaders,
    query: PortfolioDashboardsQuerySchema,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio dashboards retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: PortfolioDashboardsResponseSchema,
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
    [STATUS_CODES.BAD_REQUEST]: {
      description: 'Dashboard query validation failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ValidationErrorResponseSchema,
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
      description: 'Portfolio dashboards could not be retrieved',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default dashboardsRoute;
