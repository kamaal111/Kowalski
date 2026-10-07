import { randomUUID } from 'node:crypto';

import { symmetricEncrypt } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { exportJWK, generateKeyPair, importJWK, jwtVerify } from 'jose';
import { describe, expect } from 'vitest';
import z from 'zod';

import env from '../../api/env.ts';
import { jwks, session, user } from '../../db/schema/better-auth.ts';
import { integrationTest } from '../../tests/fixtures.ts';
import { createAuth } from '../better-auth.ts';
import { findSigningKeys, retireSigningKeys } from '../repositories/signing-keys.ts';
import { inspectSigningKeys, recoverSigningKeys } from '../services/signing-keys.ts';

describe('Signing key diagnostics and recovery', () => {
  integrationTest(
    'sign-in recovers after explicit key retirement without changing the account',
    async ({ db, app, sessionToken, userId, withRequestId, getLogsForRequestId }) => {
      const auth = createAuth(db);
      await auth.api.getToken({ headers: new Headers({ Authorization: `Bearer ${sessionToken}` }) });
      await db.update(jwks).set({ privateKey: 'invalid-json' });
      const users = await db.select().from(user).where(eq(user.id, userId));
      const accountUser = z.object({ email: z.string() }).parse(users.at(0));
      const { headers, requestId } = withRequestId({ 'Content-Type': 'application/json', Origin: 'kowalski://' });
      const body = JSON.stringify({ email: accountUser.email, password: 'password123' });

      const failed = await app.request('/app-api/auth/sign-in/email', { method: 'POST', headers, body });

      expect(failed.status).toBe(500);
      expect(getLogsForRequestId(requestId)).toContainEqual(
        expect.objectContaining({ event: 'auth.jwt.signing_key', reason: 'private_key_storage_invalid' }),
      );
      await recoverSigningKeys(db, auth);
      const signedIn = await app.request('/app-api/auth/sign-in/email', { method: 'POST', headers, body });
      expect(signedIn.status).toBe(200);
      expect(signedIn.headers.get('set-auth-token')).toBeTruthy();
      expect(await db.select().from(user).where(eq(user.id, userId))).toEqual(users);
    },
  );

  integrationTest(
    'rolls back retirement if a key changes between inspection and recovery',
    async ({ db, sessionToken }) => {
      const auth = createAuth(db);
      await auth.api.getToken({ headers: new Headers({ Authorization: `Bearer ${sessionToken}` }) });
      const keys = await findSigningKeys(db);
      const key = z.object({ id: z.string() }).parse(keys.at(0));
      await db.update(jwks).set({ privateKey: 'concurrently-changed' }).where(eq(jwks.id, key.id));

      await expect(retireSigningKeys(db, keys, new Date())).rejects.toThrow('Signing keys changed during recovery');

      const after = await findSigningKeys(db);
      expect(after.at(0)?.expiresAt).toBeNull();
      expect(after.at(0)?.privateKey).toBe('concurrently-changed');
    },
  );

  integrationTest('accepts legacy encrypted keys and exposes only safe diagnostic fields', async ({ db }) => {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
    const privateJwk = JSON.stringify(await exportJWK(privateKey));
    const encrypted = await symmetricEncrypt({ key: env.BETTER_AUTH_SECRET, data: privateJwk });
    const id = randomUUID();

    await db.insert(jwks).values({
      id,
      privateKey: JSON.stringify(encrypted),
      publicKey: JSON.stringify(await exportJWK(publicKey)),
      createdAt: new Date(),
    });

    const reports = await inspectSigningKeys(db, createAuth(db));

    expect(reports).toContainEqual(
      expect.objectContaining({ key_id: id, reason: 'signing_key_valid', private_key_format: 'legacy_hex' }),
    );
    expect(JSON.stringify(reports)).not.toContain(encrypted);
    expect(JSON.stringify(reports)).not.toContain(privateJwk);
    expect(JSON.stringify(reports)).not.toContain(env.BETTER_AUTH_SECRET);
    expect(await recoverSigningKeys(db, createAuth(db))).toEqual([]);
  });

  integrationTest(
    'distinguishes malformed storage, missing secret versions, and decryption failure',
    async ({ db }) => {
      const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
      const publicJwk = JSON.stringify(await exportJWK(publicKey));
      const plaintext = JSON.stringify(await exportJWK(privateKey));
      const encrypted = await symmetricEncrypt({ key: 'other-test-secret', data: plaintext });

      const versioned = await symmetricEncrypt({
        key: { currentVersion: 9, keys: new Map([[9, 'versioned-test-secret']]) },
        data: plaintext,
      });

      await db.insert(jwks).values([
        { id: 'malformed', publicKey: publicJwk, privateKey: 'not-json', createdAt: new Date() },
        { id: 'undecryptable', publicKey: publicJwk, privateKey: JSON.stringify(encrypted), createdAt: new Date() },
        { id: 'versioned', publicKey: publicJwk, privateKey: JSON.stringify(versioned), createdAt: new Date() },
      ]);

      const reports = await inspectSigningKeys(db, createAuth(db));

      expect(reports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key_id: 'malformed', reason: 'private_key_storage_invalid' }),
          expect.objectContaining({ key_id: 'undecryptable', reason: 'private_key_decryption_failed' }),
          expect.objectContaining({ key_id: 'versioned', reason: 'secret_version_unavailable', key_secret_version: 9 }),
        ]),
      );
      expect(JSON.stringify(reports)).not.toContain(encrypted);
      expect(JSON.stringify(reports)).not.toContain(versioned);
      expect(JSON.stringify(reports)).not.toContain(plaintext);
    },
  );

  integrationTest(
    'recovery preserves users, sessions, and old JWT verification while enabling new tokens',
    async ({ db, app, sessionToken }) => {
      const auth = createAuth(db);
      const headers = new Headers({ Authorization: `Bearer ${sessionToken}` });
      const tokenResponse = await auth.api.getToken({ headers });
      const beforeKeys = await db.select().from(jwks);
      const beforeKey = z.object({ id: z.string(), publicKey: z.string() }).parse(beforeKeys.at(0));
      const beforeUsers = await db.select().from(user);
      const beforeSessions = await db.select().from(session);

      await db
        .update(jwks)
        .set({ privateKey: JSON.stringify('broken-private-key') })
        .where(eq(jwks.id, beforeKey.id));

      const retired = await recoverSigningKeys(db, auth);

      expect(retired).toEqual([beforeKey.id]);
      expect(await db.select().from(user)).toEqual(beforeUsers);
      expect(await db.select().from(session)).toEqual(beforeSessions);

      const response = await app.request('/app-api/auth/token', { headers });
      expect(response.status).toBe(200);
      const allKeys = await db.select().from(jwks);
      expect(allKeys).toHaveLength(beforeKeys.length + 1);
      expect(allKeys.find(key => key.id === beforeKey.id)).toMatchObject({
        publicKey: beforeKey.publicKey,
        expiresAt: expect.any(Date),
      });
      const publicKeys = await auth.api.getJwks();

      const oldKey = z
        .object({ kty: z.string() })
        .catchall(z.unknown())
        .parse(publicKeys.keys.find(key => key.kid === beforeKey.id));

      expect(oldKey).toBeDefined();
      await expect(jwtVerify(tokenResponse.token, await importJWK(oldKey, 'EdDSA'))).resolves.toBeDefined();
      expect(await recoverSigningKeys(db, auth)).toEqual([]);
    },
  );

  integrationTest(
    'logs actionable key diagnostics when token issuance fails without exposing key material',
    async ({ db, app, sessionToken, withRequestId, getLogsForRequestId }) => {
      const auth = createAuth(db);
      await auth.api.getToken({ headers: new Headers({ Authorization: `Bearer ${sessionToken}` }) });
      await db.update(jwks).set({ privateKey: JSON.stringify('broken-private-key') });
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${sessionToken}` });

      const response = await app.request('/app-api/auth/token', { headers });
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ code: 'TOKEN_ISSUANCE_FAILED' });
      expect(await db.select().from(session).where(eq(session.token, sessionToken))).toHaveLength(1);
      expect(logs).toContainEqual(
        expect.objectContaining({ event: 'auth.jwt.signing_key', reason: 'private_key_format_invalid' }),
      );
      expect(JSON.stringify(logs)).not.toContain('broken-private-key');
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
    },
  );
});
