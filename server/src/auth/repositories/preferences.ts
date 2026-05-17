import { eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { userPreferences } from '@/db/schema';
import { CurrencyShape, type Currency } from '@/forex/constants';

type UserPreferencesInsert = typeof userPreferences.$inferInsert;

interface UserPreferredCurrencyRecord {
  preferredCurrency: Currency | null;
}

type UpsertUserPreferredCurrencyInput = Pick<UserPreferencesInsert, 'userId' | 'preferredCurrency'>;

export async function findUserPreferredCurrencyByUserId(
  c: HonoContext,
  userId: string,
): Promise<UserPreferredCurrencyRecord | undefined> {
  const preferences = await c
    .get('db')
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

export async function upsertUserPreferredCurrency(c: HonoContext, input: UpsertUserPreferredCurrencyInput) {
  await c
    .get('db')
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
