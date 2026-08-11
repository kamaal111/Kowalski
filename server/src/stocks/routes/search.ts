import { createRoute, type RouteConfigToTypedResponse } from '@kamaalio/hono-standard-openapi';

import { OPENAPI_TAG } from '../constants.ts';
import { ErrorResponseSchema } from '../../schemas/errors.ts';
import { AuthenticationHeaders } from '../../schemas/headers.ts';
import { StocksSearchQuerySchema, StocksSearchResponseSchema } from '../schemas/search.ts';

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  summary: 'Search stocks',
  description: 'Search for stocks by symbol or company name',
  tags: [OPENAPI_TAG],
  request: {
    headers: AuthenticationHeaders,
    query: StocksSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Search stocks',
      content: {
        'application/json': {
          schema: StocksSearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Stocks not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type SearchRouteResponse = RouteConfigToTypedResponse<typeof searchRoute>;

export default searchRoute;
