import path from 'node:path';

import {
  AUTH_ROUTE_PATHS,
  authHookFailure,
  authHookSuccess,
  defineAuthHooks,
  getValueFromSetCookie,
} from '@kamaalio/kamaal-auth-hono';
import { decodeJwt } from 'jose';
import z from 'zod';

import type {
  AuthCredentials,
  AuthHookContext,
  AuthHookResult,
  AuthUser,
  AuthenticatedResult,
  IssuedToken,
  SessionLookupResult,
  SignOutResult,
  VerificationKeys,
} from '@kamaalio/kamaal-auth-hono';

import env, { IS_TEST } from '../api/env.ts';
import { APP_API_BASE_PATH, ONE_DAY_IN_SECONDS } from '../constants/common.ts';
import { jwks } from '../db/schema/better-auth.ts';
import type { Database } from '../db/index.ts';
import type { Auth } from './better-auth.ts';
import { ROUTE_NAME } from './constants.ts';

export interface AuthLocals {
  db: Database;
  auth: Auth;
}

const { BETTER_AUTH_URL, BETTER_AUTH_SESSION_UPDATE_AGE_DAYS } = env;
const BASE_PATH = path.join(APP_API_BASE_PATH, ROUTE_NAME);
const TOKEN_URL = new URL(path.join(BETTER_AUTH_URL, BASE_PATH, AUTH_ROUTE_PATHS.token));
const SESSION_UPDATE_AGE_SECONDS = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_UPDATE_AGE_DAYS;
const SESSION_TOKEN_COOKIE = 'better-auth.session_token';

const BetterAuthExceptionSchema = z.object({ code: z.string(), message: z.string() });
const TokenResponseSchema = z.object({ token: z.string().optional() });
const PublicJWKSchema = z.object({ kty: z.string() }).catchall(z.unknown());
const AuthUserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    emailVerified: z.boolean(),
    createdAt: z.coerce.date(),
  }),
});

async function issueJwtForSession(auth: Auth, sessionToken: string): Promise<string> {
  const tokenRequest = new Request(TOKEN_URL, {
    method: 'GET',
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  const response = await auth.handler(tokenRequest);
  if (!response.ok) {
    throw new Error('Failed to issue JWT after authentication');
  }

  const responseData = TokenResponseSchema.parse(await response.json());
  if (!responseData.token) {
    throw new Error('Token not found in response');
  }

  return responseData.token;
}

function expiresInSecondsFrom(jwt: string): number {
  const payload = decodeJwt(jwt);
  const expiresAt = payload.exp;
  if (expiresAt == null) return ONE_DAY_IN_SECONDS * env.JWT_EXPIRY_DAYS;

  return expiresAt - Math.floor(Date.now() / 1000);
}

async function emailPasswordAuth(
  c: AuthHookContext<AuthLocals>,
  routePath: string,
): Promise<AuthHookResult<AuthenticatedResult<AuthUser>>> {
  const response = await c.locals.auth.handler(c.request);
  const jsonResponse: unknown = await response.json();
  const exceptionResult = BetterAuthExceptionSchema.safeParse(jsonResponse);
  if (exceptionResult.success) {
    return authHookFailure({
      code: exceptionResult.data.code,
      message: exceptionResult.data.message,
      headers: response.headers,
    });
  }

  const userResult = AuthUserResponseSchema.safeParse(jsonResponse);
  if (!userResult.success) {
    return authHookFailure({ code: 'INVALID_AUTH_RESPONSE', message: `Unexpected response from ${routePath}` });
  }

  const sessionToken = getValueFromSetCookie(response.headers, SESSION_TOKEN_COOKIE);
  if (sessionToken == null) {
    return authHookFailure({ code: 'MISSING_SESSION_TOKEN', message: 'Failed to retrieve session token' });
  }

  const authToken = await issueJwtForSession(c.locals.auth, sessionToken);
  const credentials: AuthCredentials = {
    sessionToken,
    authToken,
    authTokenExpiresInSeconds: expiresInSecondsFrom(authToken),
    sessionUpdateAgeSeconds: SESSION_UPDATE_AGE_SECONDS,
  };

  return authHookSuccess({ user: userResult.data.user, credentials });
}

export const authHooks = defineAuthHooks({
  async signUp(c: AuthHookContext<AuthLocals>): Promise<AuthHookResult<AuthenticatedResult<AuthUser>>> {
    return emailPasswordAuth(c, AUTH_ROUTE_PATHS.signUp);
  },

  async signIn(c: AuthHookContext<AuthLocals>): Promise<AuthHookResult<AuthenticatedResult<AuthUser>>> {
    return emailPasswordAuth(c, AUTH_ROUTE_PATHS.signIn);
  },

  async signOut(c: AuthHookContext<AuthLocals>): Promise<AuthHookResult<SignOutResult>> {
    const response = await c.locals.auth.handler(c.request);

    return authHookSuccess({ headers: response.headers });
  },

  async getSession(c: AuthHookContext<AuthLocals>): Promise<AuthHookResult<SessionLookupResult<AuthUser> | null>> {
    const sessionResponse = await c.locals.auth.api.getSession({ headers: c.headers });
    if (sessionResponse == null) return authHookSuccess(null);

    return authHookSuccess({
      user: {
        id: sessionResponse.user.id,
        email: sessionResponse.user.email,
        name: sessionResponse.user.name,
        emailVerified: sessionResponse.user.emailVerified,
        createdAt: sessionResponse.user.createdAt,
      },
      session: {
        expiresAt: sessionResponse.session.expiresAt,
        createdAt: sessionResponse.session.createdAt,
        updatedAt: sessionResponse.session.updatedAt,
      },
    });
  },

  async issueToken(c: AuthHookContext<AuthLocals>): Promise<AuthHookResult<IssuedToken>> {
    const response = await c.locals.auth.handler(c.request);
    if (!response.ok) {
      return authHookFailure({ code: 'SESSION_NOT_FOUND', message: 'Unauthorized' });
    }

    const responseData = TokenResponseSchema.parse(await response.json());
    if (!responseData.token) {
      return authHookFailure({ code: 'SESSION_NOT_FOUND', message: 'Unauthorized' });
    }

    return authHookSuccess({ token: responseData.token });
  },

  async jwks(c: AuthHookContext<AuthLocals>): Promise<Response> {
    return c.locals.auth.handler(c.request);
  },

  async verificationKeys(c: AuthHookContext<AuthLocals>): Promise<VerificationKeys> {
    if (!IS_TEST) return { keys: [] };

    const keyRows = await c.locals.db.select({ id: jwks.id, publicKey: jwks.publicKey }).from(jwks);
    const keys = keyRows.map(keyRow => ({ ...PublicJWKSchema.parse(JSON.parse(keyRow.publicKey)), kid: keyRow.id }));

    return { keys };
  },
});
