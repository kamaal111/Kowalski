import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { AuthenticationHeaders } from '@/schemas/headers';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '@/schemas/errors';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { CreateEntryPayloadSchema } from '../schemas/payloads';
import { CreateEntryResponseSchema } from '../schemas/responses';
import { PortfolioEntryPathParamsSchema } from '../schemas/params';

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

export default updateEntryRoute;
