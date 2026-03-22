import { date, jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core';

import currency from '../helpers/currency';

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: text('id').primaryKey(),
    date: date('date').notNull(),
    base: currency('base').notNull(),
    rates: jsonb('rates').$type<Record<string, number>>().notNull(),
  },
  t => [unique().on(t.base, t.date), unique('exchange_rate_entry').on(t.base, t.date)],
);
