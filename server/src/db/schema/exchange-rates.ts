import { pgTable, text, unique, numeric, date } from 'drizzle-orm/pg-core';

import currency from '../helpers/currency.js';

export const exchangeRateSource = pgTable(
  'exchange_rate_source',
  {
    id: text('id').primaryKey(),
    sourceDate: date('sourceDate').notNull(),
    baseCurrency: currency('base_currency').notNull(),
  },
  t => [unique().on(t.sourceDate, t.baseCurrency), unique('source_entry').on(t.sourceDate, t.baseCurrency)],
);

export const exchangeRate = pgTable(
  'exchange_rate',
  {
    id: text('id').primaryKey(),
    currency: currency('currency').notNull(),
    rate: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => exchangeRateSource.id, { onDelete: 'cascade' }),
  },
  t => [unique().on(t.currency, t.sourceId), unique('rate_entry').on(t.currency, t.sourceId)],
);
