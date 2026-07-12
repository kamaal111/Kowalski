import { z } from '@hono/zod-openapi';

import { CurrencyShape } from '@/forex/constants';

export const MoneySchema = z
  .object({
    currency: CurrencyShape,
    value: z.number().openapi({
      description: 'Monetary value',
      example: 150.5,
    }),
  })
  .openapi('Money', {
    title: 'Money',
    description: 'Monetary value with currency',
    example: { currency: 'USD', value: 150.5 },
  });
