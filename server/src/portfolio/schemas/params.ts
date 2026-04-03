import z from 'zod';

export type PortfolioEntryPathParams = z.infer<typeof PortfolioEntryPathParamsSchema>;

export const PortfolioEntryPathParamsSchema = z
  .object({
    entryId: z.uuid().openapi({
      description: 'Unique identifier for the portfolio entry',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
  })
  .openapi('PortfolioEntryPathParams', {
    title: 'Portfolio Entry Path Parameters',
    description: 'Path parameters for a single portfolio entry',
    example: {
      entryId: '550e8400-e29b-41d4-a716-446655440000',
    },
  });
