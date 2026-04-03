import { date, index, numeric, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core';

import { stockTicker } from './stocks';
import { user } from './better-auth';
import currency from '../helpers/currency';
import auditFields from '../helpers/audit-fields';
import { TRANSACTION_TYPE_ARRAY } from '@/constants/common';

export const transactionTypesEnum = pgEnum('transaction_types', TRANSACTION_TYPE_ARRAY);

/**
 * The user's current portfolio container.
 *
 * The app currently keeps one default portfolio per user, enforced by the
 * unique constraint on `userId`.
 */
export const portfolio = pgTable(
  'portfolio',
  {
    ...auditFields,
    // Stable id for the portfolio container.
    id: text('id').primaryKey(),
    // Display name for the portfolio. Today this is the auto-created default portfolio.
    name: text('name').notNull(),
    // Owning user; list/create/update portfolio entry flows scope through this relation.
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  table => [unique('portfolio_user_id_unique').on(table.userId)],
);

/**
 * Individual buy, sell, or split transactions that power the portfolio entry APIs.
 */
export const portfolioTransaction = pgTable(
  'portfolio_transaction',
  {
    ...auditFields,
    // Stable id for a single portfolio entry returned by create/list/update APIs.
    id: text('id').primaryKey(),
    // Transaction kind selected by the user, for example buy, sell, or split.
    transactionType: transactionTypesEnum('transaction_type').notNull(),
    // Effective date of the transaction used for sorting and display.
    transactionDate: date('transaction_date').notNull(),
    // Number of shares affected by the transaction.
    amount: numeric('amount', { precision: 20, scale: 10 }).notNull(),
    // User-entered per-share price at the time of the transaction.
    purchasePrice: numeric('purchase_price', { precision: 20, scale: 10 }).notNull(),
    // Currency code for the entered purchase price.
    purchasePriceCurrency: currency('purchase_price_currency').notNull(),
    // References the normalized stock metadata row for this transaction.
    tickerId: text('ticker_id')
      .notNull()
      .references(() => stockTicker.id, { onDelete: 'no action' }),
    // Parent portfolio that owns this transaction.
    portfolioId: text('portfolio_id')
      .notNull()
      .references(() => portfolio.id, { onDelete: 'cascade' }),
  },
  table => [
    index('portfolio_transaction_portfolio_id_transaction_date_idx').on(table.portfolioId, table.transactionDate),
  ],
);
