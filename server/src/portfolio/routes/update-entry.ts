import { createRoute, type RouteConfigToTypedResponse } from '@kamaalio/hono-standard-openapi';

import { OPENAPI_TAG } from '../constants.ts';
import { AuthenticationHeaders } from '../../schemas/headers.ts';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '../../schemas/errors.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { MIME_TYPES } from '../../constants/request.ts';
import { CreateEntryPayloadSchema } from '../schemas/payloads.ts';
import { CreateEntryResponseSchema } from '../schemas/responses.ts';
import { PortfolioEntryPathParamsSchema } from '../schemas/params.ts';

const updateEntryRoute = createRoute({
  method: 'put',
  path: '/entries/{entryId}',
  tags: [OPENAPI_TAG],
  summary: 'Update portfolio entry',
  description:
    'Update an existing portfolio entry for the signed-in user. Replaces the stock details, amount, price, transaction type, and transaction date for the selected entry.',
  request: {
    headers: AuthenticationHeaders,
    params: PortfolioEntryPathParamsSchema,
    body: {
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: CreateEntryPayloadSchema,
        },
      },
    },
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Portfolio entry updated successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: CreateEntryResponseSchema,
        },
      },
    },
    [STATUS_CODES.BAD_REQUEST]: {
      description: 'Invalid portfolio entry payload',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ValidationErrorResponseSchema,
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
      description: 'Portfolio entry or session not found',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
    [STATUS_CODES.INTERNAL_SERVER_ERROR]: {
      description: 'Portfolio entry update failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type UpdateEntryRouteResponse = RouteConfigToTypedResponse<typeof updateEntryRoute>;

export default updateEntryRoute;
