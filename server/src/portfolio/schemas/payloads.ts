import z from 'zod';

import { TRANSACTION_TYPE_ARRAY } from '@/constants/common.js';
import { ApiCommonDatetimeShape } from '@/schemas/common.js';
import { StocksSearchQuoteItemResponseSchema } from '@/stocks/index.js';

const MoneySchema = z
  .object({
    currency: z.string().min(3).openapi({
      description: 'Currency code',
      example: 'USD',
    }),
    value: z.number().nonnegative().openapi({
      description: 'Monetary value (non-negative)',
      example: 150.5,
    }),
  })
  .openapi('Money', {
    title: 'Money',
    description: 'Monetary value with currency',
    example: { currency: 'USD', value: 150.5 },
  });

export type CreateEntryPayload = z.infer<typeof CreateEntryPayloadSchema>;

export const CreateEntryPayloadSchema = z
  .object({
    stock: StocksSearchQuoteItemResponseSchema,
    amount: z.number().positive().openapi({
      description: 'Number of shares/units purchased or sold (must be greater than zero)',
      example: 10,
      exclusiveMinimum: 0,
    }),
    purchase_price: MoneySchema,
    transaction_type: z.enum(TRANSACTION_TYPE_ARRAY).openapi({
      description: 'Type of transaction: buy, sell, or split',
      example: 'buy',
    }),
    transaction_date: ApiCommonDatetimeShape.openapi({
      description: 'Date and time when the transaction occurred',
      example: '2025-12-20T10:30:00.000Z',
    }),
  })
  .openapi('CreateEntryPayload', {
    title: 'Create Portfolio Entry Payload',
    description: 'Request payload for creating a new portfolio entry',
    example: {
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
    },
  });
