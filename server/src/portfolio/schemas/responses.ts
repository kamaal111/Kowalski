import * as z from 'zod';

import { ApiCommonDatetimeShape } from '@/schemas/common';
import { CreateEntryPayloadSchema, MoneySchema } from './payloads';

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

const PortfolioEntryResponseObjectSchema = z.object({
  id: z.uuid().openapi({
    description: 'Unique identifier for the portfolio entry',
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
  ...CreateEntryPayloadSchema.shape,
  ...AuditFieldsSchema.shape,
});

export type CreateEntryResponse = z.infer<typeof CreateEntryResponseSchema>;

export const CreateEntryResponseSchema = PortfolioEntryResponseObjectSchema.extend({
  preferred_currency_purchase_price: MoneySchema.nullable().openapi({
    description:
      "Entry purchase price converted into the signed-in user's preferred currency, or null when unavailable.",
    example: { currency: 'EUR', value: 138.07 },
  }),
}).openapi('CreateEntryResponse', {
  title: 'Create Portfolio Entry Response',
  description:
    "Persisted portfolio entry enriched with the signed-in user's preferred-currency purchase price when available.",
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
    preferred_currency_purchase_price: { currency: 'EUR', value: 138.07 },
    transaction_type: 'buy',
    transaction_date: '2025-12-20T00:00:00.000Z',
    created_at: '2025-12-20T12:00:00.000Z',
    updated_at: '2025-12-20T12:00:00.000Z',
  },
});

export type ListEntriesResponse = z.infer<typeof ListEntriesResponseSchema>;

export const ListEntriesResponseSchema = z.array(CreateEntryResponseSchema).openapi('ListEntriesResponse', {
  title: 'List Portfolio Entries Response',
  description: 'Response containing persisted portfolio entries for the signed-in user',
  example: [
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
      preferred_currency_purchase_price: { currency: 'EUR', value: 138.07 },
      transaction_type: 'buy',
      transaction_date: '2025-12-20T00:00:00.000Z',
      created_at: '2025-12-20T12:00:00.000Z',
      updated_at: '2025-12-20T12:00:00.000Z',
    },
  ],
});

export type CurrentValue = z.infer<typeof CurrentValueSchema>;

export const CurrentValueSchema = MoneySchema.openapi('CurrentValue', {
  title: 'Current Portfolio Value',
  description: 'Current stock price in either the preferred or native quote currency.',
  example: { currency: 'EUR', value: 185.45 },
});

export type PortfolioOverviewResponse = z.infer<typeof PortfolioOverviewResponseSchema>;

export const PortfolioOverviewResponseSchema = z
  .object({
    transactions: ListEntriesResponseSchema,
    current_values: z.record(z.string().min(1), CurrentValueSchema).openapi({
      description: 'Current stock values keyed by the transaction stock symbol.',
      example: {
        AAPL: { currency: 'EUR', value: 185.45 },
        MSFT: { currency: 'EUR', value: 420.5 },
      },
    }),
  })
  .openapi('PortfolioOverviewResponse', {
    title: 'Portfolio Overview Response',
    description:
      'Portfolio transactions with current stock values keyed by symbol for the signed-in user default portfolio.',
    example: {
      transactions: [
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
          preferred_currency_purchase_price: { currency: 'EUR', value: 138.07 },
          transaction_type: 'buy',
          transaction_date: '2025-12-20T00:00:00.000Z',
          created_at: '2025-12-20T12:00:00.000Z',
          updated_at: '2025-12-20T12:00:00.000Z',
        },
      ],
      current_values: {
        AAPL: { currency: 'EUR', value: 185.45 },
      },
    },
  });
