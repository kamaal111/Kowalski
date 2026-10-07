import { parseEnvelope, symmetricDecrypt } from 'better-auth/crypto';
import { importJWK, jwtVerify, SignJWT } from 'jose';
import z from 'zod';

import type { Database } from '../../db/index.ts';
import { logEvent, type LogBindings, type ServerLogger } from '../../logging/index.ts';
import { isString } from '../../utils/type-guards.ts';
import type { Auth } from '../better-auth.ts';
import { findSigningKeys, retireSigningKeys } from '../repositories/signing-keys.ts';

const JwkSchema = z.object({ kty: z.string() }).catchall(z.unknown());

type Secret = Parameters<typeof symmetricDecrypt>[0]['key'];

type SigningKey = Awaited<ReturnType<typeof findSigningKeys>>[number];

/** Never return encrypted data, decrypted keys, secrets, or underlying crypto errors. */
export async function inspectSigningKeys(db: Database, auth: Auth) {
  const { secretConfig } = await auth.$context;
  const keys = await findSigningKeys(db);

  return Promise.all(keys.map(key => inspectSigningKey(key, secretConfig)));
}

export async function logSigningKeyDiagnostics(context: { db: Database; auth: Auth; logger: ServerLogger }) {
  try {
    const reports = await inspectSigningKeys(context.db, context.auth);

    for (const report of reports) {
      logEvent(
        context.logger,
        'warn',
        { ...report, event: 'auth.jwt.signing_key', outcome: 'failure' },
        'JWT signing key diagnostics.',
      );
    }

    if (reports.length === 0) {
      logEvent(context.logger, 'warn', {
        event: 'auth.jwt.signing_key',
        outcome: 'failure',
        reason: 'signing_key_missing',
      });
    }
  } catch {
    logEvent(context.logger, 'warn', {
      event: 'auth.jwt.signing_key',
      outcome: 'failure',
      reason: 'diagnostics_unavailable',
    });
  }
}

/** Explicit operator action only. Authentication never automatically retires keys. */
export async function recoverSigningKeys(db: Database, auth: Auth) {
  const { secretConfig } = await auth.$context;
  const keys = await findSigningKeys(db);
  const now = new Date();
  const unreadable: SigningKey[] = [];

  for (const key of keys) {
    if (key.expiresAt != null && key.expiresAt <= now) {
      continue;
    }

    const report = await inspectSigningKey(key, secretConfig);

    if (report.reason === 'signing_key_valid') {
      continue;
    }

    // Recovery is safe only when the retained public key can still verify old tokens.
    await importJWK(JwkSchema.parse(JSON.parse(key.publicKey)), key.alg ?? 'EdDSA');
    unreadable.push(key);
  }

  return retireSigningKeys(db, unreadable, now);
}

async function inspectSigningKey(key: SigningKey, secret: Secret): Promise<LogBindings> {
  const fields: LogBindings = {
    key_id: key.id,
    key_created_at: key.createdAt.toISOString(),
    key_expires_at: key.expiresAt?.toISOString(),
    key_algorithm: key.alg ?? 'EdDSA',
    key_active: key.expiresAt == null || key.expiresAt > new Date(),
    secret_mode: isString(secret) ? 'single' : 'versioned',
  };

  let encrypted: string;

  try {
    encrypted = z.string().parse(JSON.parse(key.privateKey));
  } catch {
    return { ...fields, reason: 'private_key_storage_invalid' };
  }

  const envelope = parseEnvelope(encrypted);
  const ciphertext = envelope?.ciphertext ?? encrypted;
  fields.private_key_format = envelope == null ? 'legacy_hex' : 'versioned';
  fields.key_secret_version = envelope?.version;

  if (!/^[0-9a-f]+$/i.test(ciphertext) || ciphertext.length < 80 || ciphertext.length % 2 !== 0) {
    return { ...fields, reason: 'private_key_format_invalid' };
  }

  if (envelope != null && (isString(secret) || !secret.keys.has(envelope.version))) {
    return { ...fields, reason: 'secret_version_unavailable' };
  }

  let plaintext: string;

  try {
    plaintext = await symmetricDecrypt({ key: secret, data: encrypted });
  } catch {
    return { ...fields, reason: 'private_key_decryption_failed' };
  }

  try {
    const privateJwk = JwkSchema.extend({ d: z.string() }).parse(JSON.parse(plaintext));
    const publicJwk = JwkSchema.parse(JSON.parse(key.publicKey));
    const privateKey = await importJWK(privateJwk, key.alg ?? 'EdDSA');
    const publicKey = await importJWK(publicJwk, key.alg ?? 'EdDSA');
    const token = await new SignJWT({}).setProtectedHeader({ alg: key.alg ?? 'EdDSA' }).sign(privateKey);
    await jwtVerify(token, publicKey);

    return { ...fields, reason: 'signing_key_valid' };
  } catch {
    return { ...fields, reason: 'signing_key_material_invalid' };
  }
}
