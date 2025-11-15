import { pgTable, text, unique, timestamp, numeric } from 'drizzle-orm/pg-core';

import currency from '../helpers/currency.js';

export const stockTicker = pgTable(
  'stock_ticker',
  {
    id: text('id').primaryKey(),
    symbol: text('symbol').notNull(),
    isin: text('isin').notNull().unique(),
    name: text('name').notNull(),
  },
  t => [unique().on(t.isin, t.symbol), unique('mapping').on(t.isin, t.symbol)],
);

export const stockInfo = pgTable(
  'stock_info',
  {
    id: text('id').primaryKey(),
    currency: currency('currency').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    close: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    tickerId: text('ticker_id')
      .notNull()
      .references(() => stockTicker.id, { onDelete: 'cascade' }),
  },
  t => [unique().on(t.tickerId, t.timestamp), unique('entry').on(t.tickerId, t.timestamp)],
);
