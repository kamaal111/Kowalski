import { createRoute } from '@hono/zod-openapi';

import { OPENAPI_TAG } from '../constants';
import { requireLoggedInSessionMiddleware } from '../middleware';
import { AuthenticationHeaders } from '../../schemas/headers';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '../../schemas/errors';
import { SessionResponseSchema } from '../schemas/responses';
import { UpdatePreferencesPayloadSchema } from '../schemas/payloads';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';

const preferencesRoute = createRoute({
  method: 'patch',
  path: '/preferences',
  tags: [OPENAPI_TAG],
  summary: 'Update user preferences',
  middleware: [requireLoggedInSessionMiddleware],
  description: 'Update user preferences such as the preferred currency for new transactions.',
  request: {
    headers: AuthenticationHeaders,
    body: {
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: UpdatePreferencesPayloadSchema,
        },
      },
    },
  },
  responses: {
    [STATUS_CODES.OK]: {
      description: 'Preferences updated successfully',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: SessionResponseSchema,
        },
      },
    },
    [STATUS_CODES.BAD_REQUEST]: {
      description: 'Invalid preferences payload',
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
  },
});

export default preferencesRoute;
