import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { STATUS_CODES } from '@/constants/http';
import { MIME_TYPES } from '@/constants/request';
import { AuthenticationHeaders } from '@/schemas/headers';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '@/schemas/errors';
import { BulkCreateEntriesPayloadSchema } from '../schemas/payloads';
import { BulkCreateEntriesResponseSchema } from '../schemas/responses';

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
      description: 'Bulk portfolio entry persistence failed',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default bulkCreateEntriesRoute;
