import { date, index, numeric, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core';

import { stockTicker } from './stocks.js';
import { user } from './better-auth.js';
import currency from '../helpers/currency.js';
import auditFields from '../helpers/audit-fields.js';
import { TRANSACTION_TYPE_ARRAY } from '@/constants/common.js';

export const transactionTypesEnum = pgEnum('transaction_types', TRANSACTION_TYPE_ARRAY);

export const portfolio = pgTable(
  'portfolio',
  {
    ...auditFields,
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  table => [unique('portfolio_user_id_unique').on(table.userId)],
);

export const portfolioTransaction = pgTable(
  'portfolio_transaction',
  {
    ...auditFields,
    id: text('id').primaryKey(),
    transactionType: transactionTypesEnum('transaction_type').notNull(),
    transactionDate: date('transaction_date').notNull(),
    amount: numeric('amount', { precision: 20, scale: 10 }).notNull(),
    purchasePrice: numeric('purchase_price', { precision: 20, scale: 10 }).notNull(),
    purchasePriceCurrency: currency('purchase_price_currency').notNull(),
    tickerId: text('ticker_id')
      .notNull()
      .references(() => stockTicker.id, { onDelete: 'no action' }),
    portfolioId: text('portfolio_id')
      .notNull()
      .references(() => portfolio.id, { onDelete: 'cascade' }),
  },
  table => [
    index('portfolio_transaction_portfolio_id_transaction_date_idx').on(table.portfolioId, table.transactionDate),
  ],
);
