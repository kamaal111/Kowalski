import * as z from 'zod';

import { CurrencyShape } from '../../forex/constants.ts';

export const MoneySchema = z
  .object({
    currency: CurrencyShape,
    value: z.number().meta({
      description: 'Monetary value',
      example: 150.5,
    }),
  })
  .meta({
    $id: 'Money',
    title: 'Money',
    description: 'Monetary value with currency',
    example: { currency: 'USD', value: 150.5 },
  });
