import { date, numeric, pgTable, text, unique } from 'drizzle-orm/pg-core';

import currency from '../helpers/currency';

/**
 * Canonical stock metadata reused across portfolio transactions so we do not
 * duplicate company details on every entry.
 */
export const stockTicker = pgTable(
  'stock_ticker',
  {
    // Synthetic id derived from exchange and symbol and used by portfolio transactions.
    id: text('id').primaryKey(),
    // Exchange-specific stock symbol shown in search results and portfolio responses.
    symbol: text('symbol').notNull(),
    // Stable instrument identifier used to match or refresh ticker metadata.
    isin: text('isin').notNull().unique(),
    // Human-readable company or instrument name shown in the portfolio UI.
    name: text('name').notNull(),
    // Optional sector enrichment returned from stock search providers.
    sector: text('sector'),
    // Optional industry enrichment returned from stock search providers.
    industry: text('industry'),
    // Provider-specific exchange display label used when rebuilding ticker ids and UI labels.
    exchangeDispatch: text('exchange_dispatch'),
  },
  t => [unique().on(t.isin, t.symbol), unique('mapping').on(t.isin, t.symbol)],
);

/**
 * Daily price snapshots for a stock ticker keyed by date.
 *
 * This powers cached portfolio overview prices and stores at most one price per
 * ticker per day.
 */
export const stockInfo = pgTable(
  'stock_info',
  {
    // Unique row id for a stored price snapshot.
    id: text('id').primaryKey(),
    // Quote currency for the recorded close price.
    currency: currency('currency').notNull(),
    // Effective date for the stored market price.
    date: date('date').notNull(),
    // Stored closing price or observed rate for the ticker at the given timestamp.
    close: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    // Parent ticker whose price history this snapshot belongs to.
    tickerId: text('ticker_id')
      .notNull()
      .references(() => stockTicker.id, { onDelete: 'cascade' }),
  },
  t => [unique().on(t.tickerId, t.date), unique('entry').on(t.tickerId, t.date)],
);
