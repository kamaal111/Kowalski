import * as z from 'zod';

export type StocksSearchParams = z.infer<typeof StocksSearchParamsSchema>;

export const StocksSearchParamsSchema = z
  .object({
    query: z.string().nonempty().openapi({
      description: 'Search query for stock symbols or company names',
      example: 'AAPL',
    }),
  })
  .openapi('StocksSearchParams', {
    title: 'Stocks Search Parameters',
    description: 'Query parameters for searching stocks by symbol or company name',
    example: { query: 'AAPL' },
  });
