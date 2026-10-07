import { randomUUID } from 'node:crypto';

import { makeSignature } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, vi } from 'vitest';

import env from '../../api/env.ts';
import { ONE_DAY_IN_SECONDS } from '../../constants/common.ts';
import { createDatabaseQueryLogger } from '../../db/logging.ts';
import { session } from '../../db/schema/better-auth.ts';
import { appRelations } from '../../db/schema/index.ts';
import { getComponentLogger } from '../../logging/index.ts';
import { integrationTest } from '../../tests/fixtures.ts';
import { findSessionDiagnosticRecord } from '../repositories/session-diagnostics.ts';

const SESSION_PATH = '/app-api/auth/session';

describe('Session diagnostics', () => {
  integrationTest(
    'does not expose diagnostic token parameters through Drizzle query logging',
    async ({ db, sessionToken }) => {
      const logger = getComponentLogger('database');

      const logInfo = vi.spyOn(logger, 'info');

      const loggingDb = drizzle({
        client: db.$client,
        relations: appRelations,
        logger: createDatabaseQueryLogger(logger),
      });

      const record = await findSessionDiagnosticRecord(loggingDb, sessionToken);

      expect(record).toMatchObject({ createdAt: expect.any(Date), expiresAt: expect.any(Date) });
      const logs = JSON.stringify(logInfo.mock.calls);
      expect(logs).toContain('database.query');
      expect(logs).toContain('$1');
      expect(logs).not.toContain(sessionToken);
      logInfo.mockRestore();
      expect(record).not.toHaveProperty('token');
    },
  );

  integrationTest(
    'diagnoses a signed cookie and falls back to it when the bearer signature is invalid',
    async ({ app, sessionToken, withRequestId, getLogsForRequestId }) => {
      const signature = await makeSignature(sessionToken, env.BETTER_AUTH_SECRET);
      const cookie = `better-auth.session_token=${encodeURIComponent(`${sessionToken}.${signature}`)}`;
      const { headers, requestId } = withRequestId({ Cookie: cookie, Authorization: 'Bearer bad.signature' });

      const response = await app.request(SESSION_PATH, { headers });
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(200);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'success',
            reason: 'session_valid',
            credential_source: 'cookie',
            credential_format: 'signed',
            session_record_found: true,
          }),
        ]),
      );
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
      expect(JSON.stringify(logs)).not.toContain(signature);
    },
  );

  integrationTest(
    'a failed diagnostic query does not log its sensitive error or reject a valid session',
    async ({ app, db, sessionToken, withRequestId, getLogsForRequestId }) => {
      const signature = await makeSignature(sessionToken, env.BETTER_AUTH_SECRET);
      const cookie = `better-auth.session_token=${encodeURIComponent(`${sessionToken}.${signature}`)}`;
      const query = vi.spyOn(db.$client, 'query');
      query.mockRejectedValueOnce(new Error(`Sensitive database error: ${sessionToken}`));
      const { headers, requestId } = withRequestId({ Cookie: cookie });

      const response = await app.request(SESSION_PATH, { headers });
      query.mockRestore();
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(200);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'success',
            reason: 'session_valid',
            diagnostics_available: false,
            diagnostic_error_name: 'DrizzleQueryError',
          }),
        ]),
      );
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
      expect(JSON.stringify(logs)).not.toContain('Sensitive database error');
    },
  );

  integrationTest(
    'reports a six-day-old session as valid without exposing its token',
    async ({ app, db, sessionToken, withRequestId, getLogsForRequestId }) => {
      const createdAt = new Date(Date.now() - 6 * ONE_DAY_IN_SECONDS * 1000);
      await db.update(session).set({ createdAt, updatedAt: createdAt }).where(eq(session.token, sessionToken));
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${sessionToken}` });

      const response = await app.request(SESSION_PATH, { headers });
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(200);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'success',
            reason: 'session_valid',
            credential_source: 'bearer',
            credential_format: 'unsigned',
            session_record_found: true,
            session_created_at: createdAt.toISOString(),
            session_age_s: expect.any(Number),
            session_expires_in_s: expect.any(Number),
            session_lifetime_s: 30 * ONE_DAY_IN_SECONDS,
            session_update_age_s: ONE_DAY_IN_SECONDS,
            auth_url: expect.any(String),
            database_name: expect.any(String),
          }),
        ]),
      );
      expect(logs).not.toContainEqual(expect.objectContaining({ event: 'auth.jwt.verification' }));
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
    },
  );

  integrationTest(
    'captures expiry before Better Auth deletes the expired record',
    async ({ app, db, sessionToken, withRequestId, getLogsForRequestId }) => {
      const expiresAt = new Date(Date.now() - ONE_DAY_IN_SECONDS * 1000);
      await db.update(session).set({ expiresAt }).where(eq(session.token, sessionToken));
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${sessionToken}` });

      const response = await app.request(SESSION_PATH, { headers });

      const remainingSessions = await db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.token, sessionToken));

      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: 'SESSION_NOT_FOUND' });
      expect(remainingSessions).toHaveLength(0);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'failure',
            reason: 'session_expired',
            session_record_found: true,
            session_expires_at: expiresAt.toISOString(),
            session_expires_in_s: expect.any(Number),
          }),
        ]),
      );
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
    },
  );

  integrationTest(
    'distinguishes a revoked session from expiry',
    async ({ app, db, sessionToken, withRequestId, getLogsForRequestId }) => {
      await db.delete(session).where(eq(session.token, sessionToken));
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${sessionToken}` });

      const response = await app.request(SESSION_PATH, { headers });
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(401);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'failure',
            reason: 'session_record_missing',
            session_record_found: false,
          }),
        ]),
      );
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
    },
  );

  integrationTest(
    'identifies a signed bearer rejected by the current secret without exposing credentials',
    async ({ app, sessionToken, withRequestId, getLogsForRequestId }) => {
      const credential = `${sessionToken}.invalid-signature`;
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${credential}` });

      const response = await app.request(SESSION_PATH, { headers });
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(401);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'failure',
            reason: 'signature_invalid',
            credential_source: 'bearer',
            credential_format: 'signed',
          }),
        ]),
      );
      expect(JSON.stringify(logs)).not.toContain(sessionToken);
      expect(JSON.stringify(logs)).not.toContain('invalid-signature');
    },
  );

  integrationTest(
    'accepts the encoded signed bearer issued by sign-up',
    async ({ app, withRequestId, getLogsForRequestId }) => {
      const signUpResponse = await app.request('/app-api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${randomUUID()}@example.com`, password: 'password123', name: 'Test User' }),
      });

      expect(signUpResponse.status).toBe(201);

      const credential = signUpResponse.headers.get('set-session-token');
      expect(credential).toBeTruthy();
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${credential}` });

      const response = await app.request(SESSION_PATH, { headers });
      const logs = getLogsForRequestId(requestId);

      expect(response.status).toBe(200);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'success',
            reason: 'session_valid',
            credential_source: 'bearer',
            credential_format: 'signed',
            session_record_found: true,
          }),
        ]),
      );
      expect(JSON.stringify(logs)).not.toContain(credential);
    },
  );

  integrationTest(
    'reports a missing credential separately from a missing record',
    async ({ app, withRequestId, getLogsForRequestId }) => {
      const { headers, requestId } = withRequestId();

      const response = await app.request(SESSION_PATH, { headers });

      expect(response.status).toBe(401);
      expect(getLogsForRequestId(requestId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'failure',
            reason: 'credential_missing',
            credential_source: 'none',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'logs the same rejection details when refreshing a token',
    async ({ app, db, sessionToken, withRequestId, getLogsForRequestId }) => {
      await db.delete(session).where(eq(session.token, sessionToken));
      const { headers, requestId } = withRequestId({ Authorization: `Bearer ${sessionToken}` });

      const response = await app.request('/app-api/auth/token', { headers });

      expect(response.status).toBe(401);
      expect(getLogsForRequestId(requestId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'auth.session.diagnostics',
            outcome: 'failure',
            reason: 'session_record_missing',
            route: '/app-api/auth/token',
            session_record_found: false,
          }),
        ]),
      );
    },
  );
});
