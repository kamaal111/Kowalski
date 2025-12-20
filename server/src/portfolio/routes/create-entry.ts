import { createRoute } from '@hono/zod-openapi';
import z from 'zod';

import { OPENAPI_TAG } from '../constants.js';
import { requireLoggedInSessionMiddleware } from '@/auth/middleware.js';
import { AuthenticationHeaders } from '@/schemas/headers.js';
import { ErrorResponseSchema } from '@/schemas/errors.js';
import { STATUS_CODES } from '@/constants/http.js';
import { MIME_TYPES } from '@/constants/request.js';
import { ApiCommonDatetimeShape } from '@/schemas/common.js';
import { CreateEntryPayloadSchema } from '../schemas/payloads.js';

const AuditFieldsSchema = z.object({
  created_at: ApiCommonDatetimeShape.openapi({
    description: 'Timestamp when the entry was created',
    example: '2025-12-20T12:00:00.000Z',
  }),
  updated_at: ApiCommonDatetimeShape.openapi({
    description: 'Timestamp when the entry was last updated',
    example: '2025-12-20T12:00:00.000Z',
  }),
});

const CreateEntryResponseSchema = AuditFieldsSchema.extend({
  id: z.string().nonempty().openapi({
    description: 'Unique identifier for the portfolio entry',
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
})
  .extend(CreateEntryPayloadSchema.shape)
  .openapi('CreateEntryResponse', {
    title: 'Create Portfolio Entry Response',
    description: 'Response containing the created portfolio entry with audit fields',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      stock: {
        symbol: 'AAPL',
        exchange: 'NMS',
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        exchange_dispatch: 'NASDAQ',
      },
      amount: 10,
      purchase_price: { currency: 'USD', value: 150.5 },
      transaction_type: 'buy',
      transaction_date: '2025-12-20T10:30:00.000Z',
      created_at: '2025-12-20T12:00:00.000Z',
      updated_at: '2025-12-20T12:00:00.000Z',
    },
  });

const createEntryRoute = createRoute({
  method: 'post',
  path: '/entry',
  tags: [OPENAPI_TAG],
  summary: 'Create portfolio entry',
  middleware: [requireLoggedInSessionMiddleware],
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
      description: 'Bad request',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
    [STATUS_CODES.NOT_FOUND]: {
      description: 'Portfolio entry not found',
      content: {
        [MIME_TYPES.APPLICATION_JSON]: {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export default createEntryRoute;
