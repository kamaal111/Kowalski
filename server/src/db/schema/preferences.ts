import { pgTable, text } from 'drizzle-orm/pg-core';

import { user } from './better-auth';
import auditFields from '../helpers/audit-fields';
import currency from '../helpers/currency';

/**
 * App-owned per-user preferences that extend Better Auth's user record.
 *
 * The auth session middleware reads this table to enrich session responses with
 * `preferred_currency`, and `PATCH /auth/preferences` upserts it when the user
 * changes their default transaction currency.
 */
export const userPreferences = pgTable('user_preferences', {
  ...auditFields,
  // Shared primary key and foreign key to the owning auth user.
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Default currency echoed in auth session responses and used to prefill new transactions.
  preferredCurrency: currency('preferred_currency'),
});
