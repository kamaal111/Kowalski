import * as z from 'zod';

export type StocksSearchQuery = z.infer<typeof StocksSearchQuerySchema>;

export const StocksSearchQuerySchema = z
  .object({
    q: z.string().nonempty().openapi({
      description: 'Search query for stock symbols, ISINs, or company names',
      example: 'AAPL',
    }),
  })
  .openapi('StocksSearchParams', {
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
const OptionalNullableString = z
  .string()
  .trim()
  .transform(val => (val === '' ? null : val))
  .nullish();

export const StocksSearchQuoteItemResponseSchema = z
  .object({
    symbol: z.string().nonempty().openapi({
      description: 'Stock symbol',
      example: 'AAPL',
    }),
    exchange: z.string().nonempty().openapi({
      description: 'Exchange code where the stock is traded',
      example: 'NMS',
    }),
    name: z.string().nonempty().openapi({
      description: 'Company name',
      example: 'Apple Inc.',
    }),
    isin: OptionalNullableString.openapi({
      description: 'International Securities Identification Number',
      example: 'US0378331005',
    }),
    sector: NullableString.openapi({
      description: 'Business sector',
      example: 'Technology',
    }),
    industry: NullableString.openapi({
      description: 'Industry classification',
      example: 'Consumer Electronics',
    }),
    exchange_dispatch: NullableString.openapi({
      description: 'Display name for the exchange',
      example: 'NASDAQ',
    }),
  })
  .openapi('StocksSearchQuoteItem', {
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
    count: z.number().int().gte(0).openapi({
      description: 'Total number of search results',
      example: 1,
    }),
    quotes: z.array(StocksSearchQuoteItemResponseSchema).openapi({
      description: 'Array of stock quotes matching the search query',
    }),
  })
  .openapi('StocksSearchResponse', {
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
