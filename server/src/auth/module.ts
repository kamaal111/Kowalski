import {
  AuthenticationHeaders,
  createAuthModule,
  SessionResponseSchema as BaseSessionResponseSchema,
  UserSchema as BaseUserSchema,
} from '@kamaalio/kamaal-auth-hono';
import { createRoute } from '@kamaalio/hono-standard-openapi';
import * as z from 'zod';

import type { Context } from 'hono';
import { every } from 'hono/combine';

import env, { IS_TEST } from '../api/env.ts';
import type { HonoEnvironment } from '../api/contexts.ts';
import { openAPIRouterFactory } from '../api/open-api.ts';
import { ONE_DAY_IN_SECONDS } from '../constants/common.ts';
import { STATUS_CODES } from '../constants/http.ts';
import { MIME_TYPES } from '../constants/request.ts';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '../schemas/errors.ts';
import { CurrencyShape, DEFAULT_PREFERRED_CURRENCY } from '../forex/constants.ts';
import { logInfo } from '../logging/index.ts';
import { withRequestLogger } from '../logging/http.ts';
import { JWKS_URL } from './better-auth.ts';
import { OPENAPI_TAG, ROUTE_NAME } from './constants.ts';
import { authHooks, type AuthLocals } from './hooks.ts';
import { findUserPreferredCurrencyByUserId, upsertUserPreferredCurrency } from './repositories/preferences.ts';
import { UpdatePreferencesPayloadSchema } from './schemas/payloads.ts';

export const AUTH_BASE_PATH = `/app-api${ROUTE_NAME}`;

const TRUSTED_ORIGINS = ['kowalski://'];

const SessionExtrasSchema = z.object({
  preferred_currency: CurrencyShape,
  has_preferred_currency_preference: z.boolean(),
});

/** Parses at runtime what `authModule.schemas.SessionResponseSchema` only documents. */
export const SessionResponseSchema = BaseSessionResponseSchema.extend({
  user: BaseUserSchema.extend(SessionExtrasSchema.shape),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// Type arguments spelled out so `extraRoutes` gets `E` pinned; inference widens it to bare `Env`.
export const authModule = createAuthModule<
  { id: string; email: string; name: string; emailVerified: boolean; createdAt: Date },
  { email: string; password: string; name: string; callbackURL?: string | undefined },
  { email: string; password: string; callbackURL?: string | undefined },
  typeof SessionExtrasSchema,
  AuthLocals,
  HonoEnvironment
>({
  hooks: authHooks,
  router: openAPIRouterFactory(),
  locals: (c): AuthLocals => ({ db: c.get('db'), auth: c.get('auth') }),
  requestId: c => c.get('requestId'),
  logger: c => withRequestLogger(c, { component: 'auth' }),
  config: {
    basePath: AUTH_BASE_PATH,
    trustedOrigins: TRUSTED_ORIGINS,
    session: {
      expiresInSeconds: ONE_DAY_IN_SECONDS * env.BETTER_AUTH_SESSION_EXPIRY_DAYS,
      updateAgeSeconds: ONE_DAY_IN_SECONDS * env.BETTER_AUTH_SESSION_UPDATE_AGE_DAYS,
    },
    jwt: {
      issuer: env.BETTER_AUTH_URL,
      audience: env.BETTER_AUTH_URL,
      expiresInSeconds: ONE_DAY_IN_SECONDS * env.JWT_EXPIRY_DAYS,
      jwksUrl: JWKS_URL,
    },
    isTest: IS_TEST,
    openApi: { tag: OPENAPI_TAG },
    errorSchemas: { error: ErrorResponseSchema, validation: ValidationErrorResponseSchema },
  },
  sessionExtras: {
    schema: SessionExtrasSchema,
    resolve: async (c, { userId }) => {
      const preferences = await findUserPreferredCurrencyByUserId(c.locals.db, userId);
      if (preferences?.preferredCurrency == null) {
        return { preferred_currency: DEFAULT_PREFERRED_CURRENCY, has_preferred_currency_preference: false };
      }

      return { preferred_currency: preferences.preferredCurrency, has_preferred_currency_preference: true };
    },
  },
  extraRoutes: (router, deps) => {
    const preferencesRoute = createRoute({
      method: 'patch',
      path: '/preferences',
      tags: [OPENAPI_TAG],
      summary: 'Update user preferences',
      // `every` bridges the app-typed handler to `createRoute`'s bare-`Env` middleware type.
      middleware: [every(deps.requireSessionMiddleware)] as const,
      description: 'Update user preferences such as the preferred currency for new transactions.',
      request: {
        headers: AuthenticationHeaders,
        body: { content: { [MIME_TYPES.APPLICATION_JSON]: { schema: UpdatePreferencesPayloadSchema } } },
      },
      responses: {
        [STATUS_CODES.OK]: {
          description: 'Preferences updated successfully',
          content: { [MIME_TYPES.APPLICATION_JSON]: { schema: deps.schemas.SessionResponseSchema } },
        },
        [STATUS_CODES.BAD_REQUEST]: {
          description: 'Invalid preferences payload',
          content: { [MIME_TYPES.APPLICATION_JSON]: { schema: ValidationErrorResponseSchema } },
        },
        [STATUS_CODES.UNAUTHORIZED]: {
          description: 'Authentication failed',
          content: { [MIME_TYPES.APPLICATION_JSON]: { schema: ErrorResponseSchema } },
        },
      },
    });

    router.openapi(preferencesRoute, async c => {
      const session = deps.getSession(c);
      const payload = c.req.valid('json');
      await upsertUserPreferredCurrency(c.get('db'), {
        userId: session.user.id,
        preferredCurrency: payload.preferred_currency,
      });

      const updated = SessionResponseSchema.parse({
        ...session,
        user: {
          ...session.user,
          preferred_currency: payload.preferred_currency,
          has_preferred_currency_preference: true,
        },
      });

      logInfo(withRequestLogger(c, { component: 'auth' }), {
        event: 'auth.preferences.updated',
        preference_key: 'preferred_currency',
        preferred_currency: payload.preferred_currency,
        user_id: session.user.id,
        outcome: 'success',
      });

      return c.json(updated, { status: STATUS_CODES.OK });
    });
  },
});

export const { requireSessionMiddleware } = authModule;

export function getSessionWhereSessionIsRequired(c: Context<HonoEnvironment>): SessionResponse {
  return SessionResponseSchema.parse(authModule.getSession(c));
}
