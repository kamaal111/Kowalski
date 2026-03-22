import * as z from 'zod';

import { ApiCommonDatetimeShape } from '@/schemas/common.js';
import { CreateEntryPayloadSchema } from './payloads.js';

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

export type CreateEntryResponse = z.infer<typeof CreateEntryResponseSchema>;

export const CreateEntryResponseSchema = z
  .object({
    id: z.uuid().openapi({
      description: 'Unique identifier for the portfolio entry',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ...CreateEntryPayloadSchema.shape,
    ...AuditFieldsSchema.shape,
  })
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
