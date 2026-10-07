import { parseCookies } from 'better-auth/cookies';
import { constantTimeEqual, makeSignature } from 'better-auth/crypto';

import env from '../../api/env.ts';
import { ONE_DAY_IN_SECONDS } from '../../constants/common.ts';
import type { Database } from '../../db/index.ts';
import { logEvent, type LogBindings, type ServerLogger } from '../../logging/index.ts';
import type { Auth } from '../better-auth.ts';
import { findSessionDiagnosticRecord } from '../repositories/session-diagnostics.ts';

interface SessionDiagnosticContext {
  db: Database;
  auth: Auth;
  logger: ServerLogger;
}

type CredentialSource = 'bearer' | 'cookie' | 'none';

type CredentialInspection =
  | { token: string; source: CredentialSource; format: 'signed' | 'unsigned' }
  | {
      reason: 'credential_missing' | 'credential_malformed' | 'signature_invalid';
      source: CredentialSource;
      format?: 'signed' | 'unsigned';
    };

const databaseUrl = new URL(env.DATABASE_URL);

const configurationFields: LogBindings = {
  auth_url: new URL(env.BETTER_AUTH_URL).origin,
  database_host: databaseUrl.hostname,
  database_port: Number(databaseUrl.port || 5432),
  database_name: databaseUrl.pathname.slice(1),
  session_lifetime_s: env.BETTER_AUTH_SESSION_EXPIRY_DAYS * ONE_DAY_IN_SECONDS,
  session_update_age_s: env.BETTER_AUTH_SESSION_UPDATE_AGE_DAYS * ONE_DAY_IN_SECONDS,
};

/** Diagnostics never authorize a request. Better Auth remains the sole authority for session validity. */
export async function captureSessionDiagnostics(
  context: SessionDiagnosticContext,
  headers: Headers,
): Promise<LogBindings> {
  const observedAt = new Date();

  try {
    const credential = await inspectCredential(context.auth, headers);

    const fields: LogBindings = {
      ...configurationFields,
      observed_at: observedAt.toISOString(),
      credential_source: credential.source,
      credential_format: credential.format,
    };

    if ('reason' in credential) {
      return { ...fields, reason: credential.reason };
    }

    const record = await findSessionDiagnosticRecord(context.db, credential.token);

    if (record == null) {
      return { ...fields, reason: 'session_record_missing', session_record_found: false };
    }

    return {
      ...fields,
      reason: record.expiresAt < observedAt ? 'session_expired' : 'provider_rejected',
      session_record_found: true,
      session_created_at: record.createdAt.toISOString(),
      session_updated_at: record.updatedAt.toISOString(),
      session_expires_at: record.expiresAt.toISOString(),
      session_age_s: Math.floor((observedAt.getTime() - record.createdAt.getTime()) / 1000),
      session_expires_in_s: Math.floor((record.expiresAt.getTime() - observedAt.getTime()) / 1000),
    };
  } catch (error) {
    // A diagnostic failure must not turn a valid login into an authentication failure.
    // Avoid raw database errors: they can contain connection strings or query parameters.
    return {
      ...configurationFields,
      observed_at: observedAt.toISOString(),
      reason: 'diagnostics_unavailable',
      diagnostic_error_name: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}

export function logSessionDiagnostics(logger: ServerLogger, fields: LogBindings, succeeded: boolean) {
  logEvent(
    logger,
    succeeded ? 'info' : 'warn',
    {
      ...fields,
      event: 'auth.session.diagnostics',
      outcome: succeeded ? 'success' : 'failure',
      reason: succeeded ? 'session_valid' : fields.reason,
      diagnostics_available: fields.reason !== 'diagnostics_unavailable',
      error_code: succeeded ? undefined : 'SESSION_NOT_FOUND',
    },
    succeeded
      ? 'Session accepted by Better Auth.'
      : 'Session rejected by Better Auth; see reason and session metadata.',
  );
}

async function inspectCredential(auth: Auth, headers: Headers): Promise<CredentialInspection> {
  const authorization = headers.get('authorization');
  const bearer = authorization?.slice(0, 7).toLowerCase() === 'bearer ' ? authorization.slice(7).trim() : undefined;
  const { secret, authCookies } = await auth.$context;
  const cookie = parseCookies(headers.get('cookie') ?? '').get(authCookies.sessionToken.name);

  if (bearer) {
    const inspection = await inspectToken(bearer, 'bearer', secret);

    if ('token' in inspection || !cookie) {
      return inspection;
    }
  }

  if (cookie) {
    return inspectToken(cookie, 'cookie', secret);
  }

  return { reason: 'credential_missing', source: 'none' };
}

async function inspectToken(value: string, source: CredentialSource, secret: string): Promise<CredentialInspection> {
  let decoded: string;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    return { reason: 'credential_malformed', source };
  }

  const parts = decoded.split('.');
  const token = parts[0];

  if (!token || parts.length > 2) {
    return { reason: 'credential_malformed', source };
  }

  if (parts.length === 1) {
    return source === 'bearer'
      ? { token, source, format: 'unsigned' }
      : { reason: 'signature_invalid', source, format: 'unsigned' };
  }

  const signature = parts[1] ?? '';
  const expected = await makeSignature(token, secret);

  if (!constantTimeEqual(Buffer.from(signature, 'base64'), Buffer.from(expected, 'base64'))) {
    return { reason: 'signature_invalid', source, format: 'signed' };
  }

  return { token, source, format: 'signed' };
}
