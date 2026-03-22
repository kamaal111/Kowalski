import { createMiddleware } from 'hono/factory';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
  type ResolvedKey,
} from 'jose';
import z from 'zod';

import type { HonoContext, HonoVariables } from '../api/contexts';
import { APIException } from '../api/exceptions';
import { STATUS_CODES } from '../constants/http';
import { toISO8601String } from '../utils/strings';
import { SessionNotFound } from './exceptions';
import type { SessionResponse } from './schemas/responses';
import { JWKS_URL } from './better-auth';
import { errorLogger, logger } from '../middleware/logging';
import env, { IS_TEST } from '../api/env';
import { jwks } from '../db/schema/better-auth';

const RemoteJWKS = createRemoteJWKSet(JWKS_URL);

const BetterAuthJWTPayloadSchema = z
  .object({ sub: z.string(), email: z.email(), name: z.string(), emailVerified: z.boolean() })
  .loose();
const PublicJWKSchema = z.object({ kty: z.string() }).catchall(z.unknown());

export const requireLoggedInSessionMiddleware = createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
  if (c.get('session') != null) {
    await next();
    return;
  }

  const sessionResponse = await getUserSession(c);

  c.set('session', sessionResponse);
  await next();
});

async function getUserSession(c: HonoContext): Promise<SessionResponse> {
  const jwtSessionResponse = await verifyJwt(c);
  if (jwtSessionResponse != null) return jwtSessionResponse;

  return verifySession(c);
}

async function verifySession(c: HonoContext): Promise<SessionResponse> {
  const sessionResponse = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!sessionResponse) {
    throw new SessionNotFound(c);
  }

  const response: SessionResponse = {
    session: {
      expires_at: toISO8601String(sessionResponse.session.expiresAt),
      created_at: toISO8601String(sessionResponse.session.createdAt),
      updated_at: toISO8601String(sessionResponse.session.updatedAt),
    },
    user: {
      id: sessionResponse.user.id,
      name: sessionResponse.user.name,
      email: sessionResponse.user.email,
      email_verified: sessionResponse.user.emailVerified,
      created_at: toISO8601String(sessionResponse.user.createdAt),
    },
  };

  return response;
}

async function verifyJwt(c: HonoContext): Promise<SessionResponse | null> {
  const authHeader = c.req.header('Authorization');
  if (authHeader == null) return null;
  if (!authHeader.startsWith('Bearer ')) return null;

  logger(c, `[AUTH] JWT token found, verifying with JWKS...`);

  const token = authHeader.slice(7);
  let verificationResult: JWTVerifyResult<JWTPayload> & ResolvedKey;
  const jwks = await getJwksForVerification(c);
  try {
    verificationResult = await jwtVerify(token, jwks, {
      issuer: env.BETTER_AUTH_URL,
      audience: env.BETTER_AUTH_URL,
    });
  } catch (error) {
    errorLogger(c, `[AUTH] ❌ JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }

  const payload = verificationResult.payload;
  const zResult = BetterAuthJWTPayloadSchema.safeParse(payload);
  if (!zResult.success) {
    errorLogger(c, `[AUTH] ❌ JWT payload validation failed: ${zResult.error.message}`, 'error');
    throw new APIException(c, STATUS_CODES.UNAUTHORIZED, {
      message: 'Invalid JWT payload',
      code: 'INVALID_JWT_PAYLOAD',
    });
  }

  const jwtPayload = zResult.data;

  return {
    session: {
      expires_at: toISO8601String(new Date((payload.exp ?? 0) * 1000)),
      created_at: toISO8601String(new Date((payload.iat ?? 0) * 1000)),
      updated_at: toISO8601String(new Date()),
    },
    user: {
      id: jwtPayload.sub,
      name: jwtPayload.name,
      email: jwtPayload.email,
      email_verified: jwtPayload.emailVerified,
      created_at: toISO8601String(new Date((payload.iat ?? 0) * 1000)),
    },
  };
}

async function getJwksForVerification(c: HonoContext) {
  if (!IS_TEST) return RemoteJWKS;

  const keyRows = await c.get('db').select({ id: jwks.id, publicKey: jwks.publicKey }).from(jwks);
  const keys = keyRows.map(keyRow => ({ ...PublicJWKSchema.parse(JSON.parse(keyRow.publicKey)), kid: keyRow.id }));

  return createLocalJWKSet({ keys });
}
