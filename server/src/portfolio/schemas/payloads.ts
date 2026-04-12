import z from 'zod';

import { TRANSACTION_TYPE_ARRAY } from '@/constants/common';
import { ApiCommonDatetimeShape } from '@/schemas/common';
import { StocksSearchQuoteItemResponseSchema } from '@/stocks';

export const MoneySchema = z
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
        isin: 'US0378331005',
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

export type BulkCreateEntryItemPayload = z.infer<typeof BulkCreateEntryItemPayloadSchema>;

export const BulkCreateEntryItemPayloadSchema = z
  .object({
    ...CreateEntryPayloadSchema.shape,
    id: z.uuid().optional().openapi({
      description: 'Optional client-supplied entry identifier used for idempotent imports',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
  })
  .openapi('BulkCreateEntryItemPayload', {
    title: 'Bulk Create Portfolio Entry Item Payload',
    description: 'Portfolio entry payload for bulk create requests with an optional client-supplied id',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      stock: {
        symbol: 'AAPL',
        exchange: 'NMS',
        name: 'Apple Inc.',
        isin: 'US0378331005',
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

export type BulkCreateEntriesPayload = z.infer<typeof BulkCreateEntriesPayloadSchema>;

export const BulkCreateEntriesPayloadSchema = z
  .object({
    entries: z.array(BulkCreateEntryItemPayloadSchema).openapi({
      description: 'Portfolio entries to create in a single request',
    }),
  })
  .openapi('BulkCreateEntriesPayload', {
    title: 'Bulk Create Portfolio Entries Payload',
    description: 'Request payload for creating multiple portfolio entries in a single request',
    example: {
      entries: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          stock: {
            symbol: 'AAPL',
            exchange: 'NMS',
            name: 'Apple Inc.',
            isin: 'US0378331005',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            exchange_dispatch: 'NASDAQ',
          },
          amount: 10,
          purchase_price: { currency: 'USD', value: 150.5 },
          transaction_type: 'buy',
          transaction_date: '2025-12-20T10:30:00.000Z',
        },
      ],
    },
  });
