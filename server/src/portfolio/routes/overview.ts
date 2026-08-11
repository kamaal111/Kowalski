import { createRoute, type RouteConfigToTypedResponse } from '@kamaalio/hono-standard-openapi';

import { OPENAPI_TAG } from '../constants.ts';
import { AuthenticationHeaders } from '../../schemas/headers.ts';
import { ErrorResponseSchema } from '../../schemas/errors.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { MIME_TYPES } from '../../constants/request.ts';
import { PortfolioOverviewResponseSchema } from '../schemas/responses.ts';

const overviewRoute = createRoute({
  method: 'get',
  path: '/overview',
  tags: [OPENAPI_TAG],
  summary: 'Get portfolio overview',
  description:
    'Return portfolio transactions, current stock values, aggregated holdings, and net worth for the signed-in user default portfolio.',
  request: {
    headers: AuthenticationHeaders,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio overview retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: PortfolioOverviewResponseSchema,
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
      description: 'Portfolio overview could not be retrieved',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type OverviewRouteResponse = RouteConfigToTypedResponse<typeof overviewRoute>;

export default overviewRoute;
