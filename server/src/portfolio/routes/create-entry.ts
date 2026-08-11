import { createRoute, type RouteConfigToTypedResponse } from '@kamaalio/hono-standard-openapi';

import { OPENAPI_TAG } from '../constants.ts';
import { AuthenticationHeaders } from '../../schemas/headers.ts';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '../../schemas/errors.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { MIME_TYPES } from '../../constants/request.ts';
import { CreateEntryPayloadSchema } from '../schemas/payloads.ts';
import { CreateEntryResponseSchema } from '../schemas/responses.ts';

const createEntryRoute = createRoute({
  method: 'post',
  path: '/entries',
  tags: [OPENAPI_TAG],
  summary: 'Create portfolio entry',
  description:
    'Create a new portfolio entry for a stock transaction. Records buy, sell, or split transactions with stock details, amount, price, and transaction date.',
  request: {
    headers: AuthenticationHeaders,
    body: {
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: CreateEntryPayloadSchema,
        },
      },
    },
  },
  responses: {
    [STATUS_CODES.CREATED]: {
      description: 'Portfolio entry created successfully',
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
      description: 'Session not found',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
    [STATUS_CODES.INTERNAL_SERVER_ERROR]: {
      description: 'Portfolio entry persistence failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type CreateEntryRouteResponse = RouteConfigToTypedResponse<typeof createEntryRoute>;

export default createEntryRoute;
