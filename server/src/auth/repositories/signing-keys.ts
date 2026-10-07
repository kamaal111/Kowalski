import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../../db/index.ts';
import { jwks } from '../../db/schema/better-auth.ts';

export function findSigningKeys(db: Database) {
  return db.select().from(jwks);
}

type SigningKey = typeof jwks.$inferSelect;

/** Retain public keys for verification; only stop using these rows for signing. */
export async function retireSigningKeys(db: Database, keys: SigningKey[], retiredAt: Date) {
  return db.transaction(async transaction => {
    const retired: string[] = [];

    for (const key of keys) {
      const updated = await transaction
        .update(jwks)
        .set({ expiresAt: retiredAt })
        .where(
          and(
            eq(jwks.id, key.id),
            eq(jwks.privateKey, key.privateKey),
            eq(jwks.publicKey, key.publicKey),
            key.expiresAt == null ? isNull(jwks.expiresAt) : eq(jwks.expiresAt, key.expiresAt),
          ),
        )
        .returning({ id: jwks.id });

      if (updated.length !== 1) {
        throw new Error('Signing keys changed during recovery; no keys were retired. Retry inspection.');
      }

      retired.push(key.id);
    }

    return retired;
  });
}
