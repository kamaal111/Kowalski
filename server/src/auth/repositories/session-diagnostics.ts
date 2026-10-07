import { eq } from 'drizzle-orm';

import type { Database } from '../../db/index.ts';
import { session } from '../../db/schema/better-auth.ts';

/** Capture expiry before Better Auth can remove an expired session. Never select credentials or personal data. */
export async function findSessionDiagnosticRecord(db: Database, token: string) {
  const records = await db
    .select({ createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt })
    .from(session)
    .where(eq(session.token, token))
    .limit(1);

  return records.at(0);
}
