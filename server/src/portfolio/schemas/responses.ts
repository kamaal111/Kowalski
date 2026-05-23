import * as z from 'zod';

import { ASSET_TYPE_ARRAY, ASSET_TYPES, RESOLVED_TRANSACTION_TYPE_ARRAY } from '@/constants/common';
import { ApiCommonDatetimeShape } from '@/schemas/common';
import { CreateEntryPayloadSchema, MoneySchema } from './payloads';
import { CurrencyShape } from '@/forex/constants';

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

const PreferredCurrencyPurchasePriceSchema = z.object(MoneySchema.shape).openapi('PreferredCurrencyPurchasePrice', {
  description: "Entry purchase price converted into the signed-in user's resolved preferred currency.",
  example: { currency: 'EUR', value: 138.07 },
});

export const CreateEntryResponseSchema = PortfolioEntryResponseObjectSchema.extend({
  preferred_currency_purchase_price: PreferredCurrencyPurchasePriceSchema,
}).openapi('CreateEntryResponse', {
  title: 'Create Portfolio Entry Response',
  description: "Persisted portfolio entry enriched with the signed-in user's preferred-currency purchase price.",
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

export type ResolvedEntryResponse = z.infer<typeof ResolvedEntryResponseSchema>;

export const ResolvedEntryResponseSchema = PortfolioEntryResponseObjectSchema.extend({
  preferred_currency_purchase_price: PreferredCurrencyPurchasePriceSchema,
  transaction_type: z.enum(RESOLVED_TRANSACTION_TYPE_ARRAY).openapi({
    description: 'Resolved transaction type returned by portfolio list and overview responses',
    example: 'buy',
  }),
}).openapi('ResolvedEntryResponse', {
  title: 'Resolved Portfolio Entry Response',
  description:
    'Portfolio entry returned by portfolio list and overview responses after split transactions are resolved into buy and sell pairs.',
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

export const ListEntriesResponseSchema = z.array(ResolvedEntryResponseSchema).openapi('ListEntriesResponse', {
  title: 'List Portfolio Entries Response',
  description:
    'Response containing portfolio entries for the signed-in user after any stored split transactions are resolved into buy and sell entries.',
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

export type BulkCreateEntriesResponse = z.infer<typeof BulkCreateEntriesResponseSchema>;

export const BulkCreateEntriesResponseSchema = z.array(CreateEntryResponseSchema).openapi('BulkCreateEntriesResponse', {
  title: 'Bulk Create Portfolio Entries Response',
  description: 'Response containing the portfolio entries created by a bulk create request',
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
  description:
    "Current stock price in the signed-in user's preferred currency when conversion is required, or the native quote currency when no conversion is needed.",
  example: { currency: 'EUR', value: 185.45 },
});

const PortfolioHoldingValueSchema = z
  .object({
    currency: CurrencyShape,
    value: z.number().openapi({
      description: 'Monetary value',
      example: 1854.5,
    }),
  })
  .openapi('PortfolioHoldingValue', {
    title: 'Portfolio Holding Value',
    description: 'Monetary value with currency for aggregated portfolio holdings.',
    example: { currency: 'USD', value: 1854.5 },
  });

const PortfolioHoldingProfitLossSchema = z
  .object({
    amount: PortfolioHoldingValueSchema.openapi({
      description: 'Total unrealized profit or loss for the holding.',
      example: { currency: 'EUR', value: 469.8 },
    }),
    percentage: z.number().nullable().openapi({
      description: 'Profit or loss as a percentage of the holding cost basis, or null when cost basis is zero.',
      example: 33.9,
    }),
  })
  .nullable()
  .openapi('PortfolioHoldingProfitLoss', {
    title: 'Portfolio Holding Profit Loss',
    description: 'Unrealized profit or loss for an aggregated portfolio holding.',
    example: {
      amount: { currency: 'EUR', value: 469.8 },
      percentage: 33.9,
    },
  });

export const PortfolioHoldingAssetSchema = CreateEntryPayloadSchema.shape.stock.openapi('PortfolioHoldingAsset', {
  title: 'Portfolio Holding Asset',
  description: 'Asset metadata for an aggregated portfolio holding.',
  example: {
    symbol: 'AAPL',
    exchange: 'NMS',
    name: 'Apple Inc.',
    isin: 'US0378331005',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    exchange_dispatch: 'NASDAQ',
  },
});

export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>;

export const PortfolioHoldingSchema = z
  .object({
    asset_type: z.enum(ASSET_TYPE_ARRAY).openapi({
      description: 'Type of asset represented by the holding.',
      example: ASSET_TYPES.EQUITY,
    }),
    asset: PortfolioHoldingAssetSchema,
    amount: z.number().openapi({
      description: 'Net amount held for the asset.',
      example: 10,
    }),
    unit_value: CurrentValueSchema.openapi({
      description:
        "Current per-share value in the signed-in user's preferred currency when configured, otherwise quote currency.",
      example: { currency: 'EUR', value: 185.45 },
    }),
    total_value: PortfolioHoldingValueSchema.openapi({
      description: 'Total holding value calculated as amount times unit value.',
      example: { currency: 'EUR', value: 1854.5 },
    }),
    profit_loss: PortfolioHoldingProfitLossSchema.openapi({
      description:
        'Unrealized profit or loss calculated from the holding cost basis and current total value, or null when cost basis currency conversion is unavailable.',
    }),
  })
  .openapi('PortfolioHolding', {
    title: 'Portfolio Holding',
    description: 'Aggregated portfolio holding for a single asset.',
    example: {
      asset_type: ASSET_TYPES.EQUITY,
      asset: {
        symbol: 'AAPL',
        exchange: 'NMS',
        name: 'Apple Inc.',
        isin: 'US0378331005',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        exchange_dispatch: 'NASDAQ',
      },
      amount: 10,
      unit_value: { currency: 'EUR', value: 185.45 },
      total_value: { currency: 'EUR', value: 1854.5 },
      profit_loss: {
        amount: { currency: 'EUR', value: 473.8 },
        percentage: 34.32,
      },
    },
  });

export const PortfolioOverviewPreflightResponseSchema = z
  .object({
    refresh_state: z.enum(['ready', 'refreshing']).openapi({
      description: 'Whether daily prices are ready for a full holdings fetch.',
      example: 'refreshing',
    }),
    poll_after_ms: z.number().int().min(1).nullable().openapi({
      description: 'Recommended client polling interval when refresh_state is refreshing.',
      example: 1500,
    }),
    latest_cached_price_date: z.string().nullable().openapi({
      description: 'Latest cached price date available across the active holdings ticker set.',
      example: '2026-05-17',
    }),
  })
  .openapi('PortfolioOverviewPreflightResponse', {
    title: 'Portfolio Overview Preflight Response',
    description: 'Readiness state for fetching a fresh portfolio overview.',
    example: {
      refresh_state: 'refreshing',
      poll_after_ms: 3000,
      latest_cached_price_date: '2026-05-16',
    },
  });

export type PortfolioOverviewPreflightResponse = z.infer<typeof PortfolioOverviewPreflightResponseSchema>;

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
    holdings: z.array(PortfolioHoldingSchema).openapi({
      description: 'Aggregated holdings for the signed-in user default portfolio.',
    }),
    net_worth: PortfolioHoldingValueSchema.openapi({
      description: 'Sum of total holding values.',
      example: { currency: 'EUR', value: 1854.5 },
    }),
  })
  .openapi('PortfolioOverviewResponse', {
    title: 'Portfolio Overview Response',
    description:
      'Portfolio transactions, current stock values, aggregated holdings, and net worth for the signed-in user default portfolio.',
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
      holdings: [
        {
          asset_type: ASSET_TYPES.EQUITY,
          asset: {
            symbol: 'AAPL',
            exchange: 'NMS',
            name: 'Apple Inc.',
            isin: 'US0378331005',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            exchange_dispatch: 'NASDAQ',
          },
          amount: 10,
          unit_value: { currency: 'EUR', value: 185.45 },
          total_value: { currency: 'EUR', value: 1854.5 },
          profit_loss: {
            amount: { currency: 'EUR', value: 473.8 },
            percentage: 34.32,
          },
        },
      ],
      net_worth: { currency: 'EUR', value: 1854.5 },
    },
  });
