import { auth } from './better-auth.ts';
import { inspectSigningKeys, recoverSigningKeys } from './services/signing-keys.ts';
import db from '../db/index.ts';

try {
  const reports = await inspectSigningKeys(db, auth);
  process.stdout.write(`${JSON.stringify({ signing_keys: reports }, null, 2)}\n`);

  if (process.argv.includes('--repair')) {
    const retired = await recoverSigningKeys(db, auth);
    process.stdout.write(
      `${JSON.stringify(
        {
          retired_key_ids: retired,
          next_step: 'Retry login. Existing public keys remain available for JWT verification.',
        },
        null,
        2,
      )}\n`,
    );
  }
} catch {
  // Crypto/database errors may contain sensitive material; keep command output safe.
  process.stderr.write(
    'Signing-key operation failed. No key material is printed. Check database connectivity and the configured key format.\n',
  );
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
