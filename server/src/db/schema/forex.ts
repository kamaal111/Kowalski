import { date, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import currency from '../helpers/currency';

/**
 * Cached daily FX rates collected from the ECB feed by the forex collector.
 */
export const exchangeRates = pgTable(
  'exchange_rates',
  {
    // Synthetic document key composed from the base currency and effective date.
    id: text('id').primaryKey(),
    // Effective date for the daily exchange-rate snapshot.
    date: date('date').notNull(),
    // When this FX snapshot was collected locally. Used to skip duplicate daily scrapes.
    collectedAt: timestamp('collected_at').defaultNow().notNull(),
    // Base currency the `rates` object is relative to.
    base: currency('base').notNull(),
    // Map of target currency codes to conversion rates for the given base and date.
    rates: jsonb('rates').$type<Record<string, number>>().notNull(),
  },
  t => [unique().on(t.base, t.date), unique('exchange_rate_entry').on(t.base, t.date)],
);
