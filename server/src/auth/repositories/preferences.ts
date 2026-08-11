import { eq } from 'drizzle-orm';

import type { Database } from '../../db/index.ts';
import { userPreferences } from '../../db/schema/index.ts';
import { CurrencyShape, type Currency } from '../../forex/constants.ts';

type UserPreferencesInsert = typeof userPreferences.$inferInsert;

interface UserPreferredCurrencyRecord {
  preferredCurrency: Currency | null;
}

type UpsertUserPreferredCurrencyInput = Pick<UserPreferencesInsert, 'userId' | 'preferredCurrency'>;

export async function findUserPreferredCurrencyByUserId(
  db: Database,
  userId: string,
): Promise<UserPreferredCurrencyRecord | undefined> {
  const preferences = await db
    .select({ preferredCurrency: userPreferences.preferredCurrency })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const preference = preferences.at(0);
  if (preference == null) {
    return undefined;
  }

  const preferredCurrency =
    preference.preferredCurrency == null ? null : CurrencyShape.parse(preference.preferredCurrency);

  return { preferredCurrency };
}

export async function upsertUserPreferredCurrency(db: Database, input: UpsertUserPreferredCurrencyInput) {
  await db
    .insert(userPreferences)
    .values({ userId: input.userId, preferredCurrency: input.preferredCurrency })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        preferredCurrency: input.preferredCurrency,
        updatedAt: new Date(),
      },
    });
}
