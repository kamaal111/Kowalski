import { createRoute, type RouteConfigToTypedResponse } from '@kamaalio/hono-standard-openapi';

import { OPENAPI_TAG } from '../constants.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { MIME_TYPES } from '../../constants/request.ts';
import { AuthenticationHeaders } from '../../schemas/headers.ts';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '../../schemas/errors.ts';
import { BulkCreateEntriesPayloadSchema } from '../schemas/payloads.ts';
import { BulkCreateEntriesResponseSchema } from '../schemas/responses.ts';

const bulkCreateEntriesRoute = createRoute({
  method: 'post',
  path: '/entries/bulk',
  tags: [OPENAPI_TAG],
  summary: 'Bulk create portfolio entries',
  description:
    'Create multiple portfolio entries in a single request. Entries whose client-supplied ids already exist are skipped so repeated imports remain idempotent.',
  request: {
    headers: AuthenticationHeaders,
    body: {
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: BulkCreateEntriesPayloadSchema,
        },
      },
    },
  },
  responses: {
    [STATUS_CODES.CREATED]: {
      description: 'Portfolio entries created successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: BulkCreateEntriesResponseSchema,
        },
      },
    },
    [STATUS_CODES.BAD_REQUEST]: {
      description: 'Invalid bulk portfolio entry payload',
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
      description: 'Bulk portfolio entry persistence or preferred currency purchase price resolution failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export type BulkCreateEntriesRouteResponse = RouteConfigToTypedResponse<typeof bulkCreateEntriesRoute>;

export default bulkCreateEntriesRoute;
