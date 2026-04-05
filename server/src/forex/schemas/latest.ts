import * as z from 'zod';

export type ForexLatestQuery = z.infer<typeof ForexLatestQuerySchema>;

export const ForexLatestQuerySchema = z
  .object({
    base: z.string().trim().optional().openapi({
      description: 'Base currency code. Invalid or missing values fall back to EUR.',
      example: 'EUR',
      default: 'EUR',
    }),
    symbols: z.string().trim().optional().openapi({
      description: 'Optional comma-separated list of target currency codes, or * for all rates.',
      example: 'USD,GBP',
    }),
  })
  .openapi('ForexLatestQuery', {
    title: 'Forex Latest Query',
    description: 'Query parameters for retrieving the latest forex snapshot in the ForexKit format.',
    example: { base: 'EUR', symbols: 'USD,GBP' },
  });

export type ForexLatestResponse = z.infer<typeof ForexLatestResponseSchema>;

export const ForexLatestResponseSchema = z
  .object({
    base: z.string().length(3).openapi({
      description: 'Base currency code for the returned rates.',
      example: 'EUR',
    }),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .openapi({
        description: 'Effective date of the returned forex snapshot.',
        example: '2026-03-29',
      }),
    rates: z.record(z.string().length(3), z.number()).openapi({
      description: 'Target currency rates keyed by currency code.',
      example: { USD: 1.09, GBP: 0.85 },
    }),
  })
  .openapi('ForexLatestResponse', {
    title: 'Forex Latest Response',
    description: 'Latest exchange rates in the contract expected by ForexKit.',
    example: {
      base: 'EUR',
      date: '2026-03-29',
      rates: { USD: 1.09, GBP: 0.85 },
    },
  });
