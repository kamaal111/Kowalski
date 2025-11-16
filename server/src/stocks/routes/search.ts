import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';

import { OPENAPI_TAG } from '../constants.js';
import { ErrorResponseSchema } from '../../schemas/errors.js';
import { AuthenticationHeaders } from '../../schemas/headers.js';
import { StocksSearchParamsSchema } from '../schemas/search.js';

const StocksSearchResponseSchema = z.object({});

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  summary: 'Search stocks',
  description: 'Search for stocks by symbol or company name',
  tags: [OPENAPI_TAG],
  request: {
    headers: AuthenticationHeaders,
    params: StocksSearchParamsSchema,
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

export default searchRoute;
