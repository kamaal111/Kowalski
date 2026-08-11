import * as z from 'zod';

export type StocksSearchQuery = z.infer<typeof StocksSearchQuerySchema>;

export const StocksSearchQuerySchema = z
  .object({
    q: z.string().nonempty().meta({
      description: 'Search query for stock symbols, ISINs, or company names',
      example: 'AAPL',
    }),
  })
  .meta({
    $id: 'StocksSearchParams',
    title: 'Stocks Search Parameters',
    description: 'Query parameters for searching stocks by symbol, ISIN, or company name',
    example: { q: 'AAPL' },
  });

export type StocksSearchQuoteItemResponse = z.infer<typeof StocksSearchQuoteItemResponseSchema>;

const NullableString = z
  .string()
  .trim()
  .transform(val => (val === '' ? null : val))
  .nullable();
const NormalizedTickerPartString = z
  .string()
  .trim()
  .min(1)
  .refine(value => /[A-Za-z0-9]/.test(value), {
    message: 'Must contain at least one letter or number',
  });
const OptionalNullableString = z
  .string()
  .trim()
  .transform(val => (val === '' ? null : val))
  .nullish();

export const StocksSearchQuoteItemResponseSchema = z
  .object({
    symbol: NormalizedTickerPartString.meta({
      description: 'Stock symbol',
      example: 'AAPL',
    }),
    exchange: NormalizedTickerPartString.meta({
      description: 'Exchange code where the stock is traded',
      example: 'NMS',
    }),
    name: z.string().nonempty().meta({
      description: 'Company name',
      example: 'Apple Inc.',
    }),
    isin: OptionalNullableString.meta({
      description: 'International Securities Identification Number',
      example: 'US0378331005',
    }),
    sector: NullableString.meta({
      description: 'Business sector',
      example: 'Technology',
    }),
    industry: NullableString.meta({
      description: 'Industry classification',
      example: 'Consumer Electronics',
    }),
    exchange_dispatch: NullableString.meta({
      description: 'Display name for the exchange',
      example: 'NASDAQ',
    }),
  })
  .meta({
    $id: 'StocksSearchQuoteItem',
    title: 'Stock Search Quote Item',
    description: 'Individual stock quote information from search results',
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

export type StocksSearchResponse = z.infer<typeof StocksSearchResponseSchema>;

export const StocksSearchResponseSchema = z
  .object({
    count: z.number().int().gte(0).meta({
      description: 'Total number of search results',
      example: 1,
    }),
    quotes: z.array(StocksSearchQuoteItemResponseSchema).meta({
      description: 'Array of stock quotes matching the search query',
    }),
  })
  .meta({
    $id: 'StocksSearchResponse',
    title: 'Stocks Search Response',
    description: 'Search results containing matching stock quotes',
    example: {
      count: 1,
      quotes: [
        {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
          isin: 'US0378331005',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          exchange_dispatch: 'NASDAQ',
        },
      ],
    },
  });
