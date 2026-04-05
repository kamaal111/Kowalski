import { eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { userPreferences } from '@/db/schema';

type UserPreferencesInsert = typeof userPreferences.$inferInsert;
type UserPreferencesSelect = typeof userPreferences.$inferSelect;

type UserPreferredCurrencyRecord = Pick<UserPreferencesSelect, 'preferredCurrency'>;
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

  return preferences.at(0);
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
