import { createRoute, type RouteConfigToTypedResponse } from '@kamaalio/hono-standard-openapi';

import { OPENAPI_TAG } from '../constants.ts';
import { AuthenticationHeaders } from '../../schemas/headers.ts';
import { ErrorResponseSchema } from '../../schemas/errors.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { MIME_TYPES } from '../../constants/request.ts';
import { PortfolioOverviewPreflightResponseSchema } from '../schemas/responses.ts';

const overviewPreflightRoute = createRoute({
  method: 'get',
  path: '/overview/preflight',
  tags: [OPENAPI_TAG],
  summary: 'Check portfolio overview price readiness',
  description: 'Return whether daily prices are ready before fetching the portfolio overview.',
  request: {
    headers: AuthenticationHeaders,
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio overview price readiness retrieved successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: PortfolioOverviewPreflightResponseSchema,
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
      description: 'Portfolio overview preflight could not be retrieved',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type OverviewPreflightRouteResponse = RouteConfigToTypedResponse<typeof overviewPreflightRoute>;

export default overviewPreflightRoute;
