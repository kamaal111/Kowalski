import { z } from '@hono/zod-openapi';

import { ASSET_TYPE_ARRAY, ASSET_TYPES, RESOLVED_TRANSACTION_TYPE_ARRAY } from '@/constants/common';
import { ApiCommonDatetimeShape } from '@/schemas/common';
import { CreateEntryPayloadSchema } from './payloads';
import { MoneySchema } from './common';
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

const PortfolioHoldingProfitLossSchema = z
  .object({
    amount: MoneySchema.openapi({
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
    total_value: MoneySchema.openapi({
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
    net_worth: MoneySchema.openapi({
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

const PortfolioGrowthPointSchema = z
  .object({
    date: z.string().openapi({
      description: 'Snapshot date for this portfolio value point.',
      example: '2025-12-20',
    }),
    value: z.number().openapi({
      description: "Total portfolio value in the signed-in user's preferred currency.",
      example: 1854.5,
    }),
    is_current: z.boolean().openapi({
      description: 'Whether this point represents the current portfolio value.',
      example: false,
    }),
  })
  .openapi('PortfolioGrowthPoint', {
    title: 'Portfolio Growth Point',
    description: 'Sparse portfolio total value snapshot for charting growth over time.',
  });

const PortfolioGrowthOverTimeSchema = z
  .object({
    currency: CurrencyShape.openapi({
      description: "Currency used for all portfolio growth values, resolved from the signed-in user's preference.",
      example: 'USD',
    }),
    points: z.array(PortfolioGrowthPointSchema).openapi({
      description: 'Sparse growth points at transaction dates plus the current value point when entries exist.',
    }),
  })
  .openapi('PortfolioGrowthOverTime', {
    title: 'Portfolio Growth Over Time',
    description: 'Portfolio total value over sparse transaction-date snapshots.',
  });

const PortfolioHoldingDistributionAssetSchema = z
  .object({
    symbol: z.string().openapi({
      description: 'Ticker symbol for the holding.',
      example: 'AAPL',
    }),
    name: z.string().openapi({
      description: 'Display name for the holding.',
      example: 'Apple Inc.',
    }),
  })
  .openapi('PortfolioHoldingDistributionAsset', {
    title: 'Portfolio Holding Distribution Asset',
    description: 'Minimal asset identity used to label a holdings distribution chart slice.',
    example: { symbol: 'AAPL', name: 'Apple Inc.' },
  });

const PortfolioHoldingDistributionMarketValueSchema = MoneySchema.openapi('PortfolioHoldingDistributionMarketValue', {
  title: 'Portfolio Holding Distribution Market Value',
  description: "Current total value of a holding in the signed-in user's preferred currency.",
  example: { currency: 'USD', value: 1854.5 },
});

const PortfolioHoldingDistributionItemSchema = z
  .object({
    asset: PortfolioHoldingDistributionAssetSchema,
    market_value: PortfolioHoldingDistributionMarketValueSchema,
  })
  .openapi('PortfolioHoldingDistributionItem', {
    title: 'Portfolio Holding Distribution Item',
    description: "A single holding's current value, used to render portfolio distribution charts.",
    example: {
      asset: { symbol: 'AAPL', name: 'Apple Inc.' },
      market_value: { currency: 'USD', value: 1854.5 },
    },
  });

export type PortfolioHoldingDistributionItem = z.infer<typeof PortfolioHoldingDistributionItemSchema>;

const PortfolioHoldingsDistributionSchema = z
  .object({
    currency: CurrencyShape.openapi({
      description: "Currency used for all holding values, resolved from the signed-in user's preference.",
      example: 'USD',
    }),
    holdings: z.array(PortfolioHoldingDistributionItemSchema).openapi({
      description: 'Current holdings ordered by descending value, used to render portfolio distribution charts.',
    }),
  })
  .openapi('PortfolioHoldingsDistribution', {
    title: 'Portfolio Holdings Distribution',
    description: "Current distribution of the signed-in user's default portfolio holdings by value.",
    example: {
      currency: 'USD',
      holdings: [
        { asset: { symbol: 'AAPL', name: 'Apple Inc.' }, market_value: { currency: 'USD', value: 1854.5 } },
        { asset: { symbol: 'MSFT', name: 'Microsoft Corporation' }, market_value: { currency: 'USD', value: 926.2 } },
      ],
    },
  });

export type PortfolioDashboardsResponse = z.infer<typeof PortfolioDashboardsResponseSchema>;

export const PortfolioDashboardsResponseSchema = z
  .object({
    portfolio_growth_over_time: PortfolioGrowthOverTimeSchema,
    portfolio_holdings_distribution: PortfolioHoldingsDistributionSchema,
  })
  .openapi('PortfolioDashboardsResponse', {
    title: 'Portfolio Dashboards Response',
    description: 'Dashboard data for the signed-in user default portfolio.',
    example: {
      portfolio_growth_over_time: {
        currency: 'USD',
        points: [
          { date: '2025-12-19', value: 750, is_current: false },
          { date: '2025-12-20', value: 1854.5, is_current: true },
        ],
      },
      portfolio_holdings_distribution: {
        currency: 'USD',
        holdings: [{ asset: { symbol: 'AAPL', name: 'Apple Inc.' }, market_value: { currency: 'USD', value: 1854.5 } }],
      },
    },
  });
