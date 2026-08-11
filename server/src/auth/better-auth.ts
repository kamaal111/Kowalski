import path from 'node:path';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { bearer, jwt } from 'better-auth/plugins';

import { APP_API_BASE_PATH, ONE_DAY_IN_SECONDS } from '../constants/common.ts';
import { ROUTE_NAME } from './constants.ts';
import db from '../db/index.ts';
import * as schema from '../db/schema/index.ts';
import env from '../api/env.ts';

import type { Database } from '../db/index.ts';

const { BETTER_AUTH_SESSION_UPDATE_AGE_DAYS, BETTER_AUTH_SESSION_EXPIRY_DAYS, JWT_EXPIRY_DAYS, BETTER_AUTH_URL } = env;
const EXPIRES_IN = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_EXPIRY_DAYS;
const UPDATE_AGE = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_UPDATE_AGE_DAYS;
const JWT_EXPIRATION_TIME = `${JWT_EXPIRY_DAYS}d`;
const BASE_PATH = path.join(APP_API_BASE_PATH, ROUTE_NAME);
const TRUSTED_ORIGINS = ['kowalski://'];

export const createAuth = (database: Database) =>
  betterAuth({
    database: drizzleAdapter(database, { provider: 'pg', schema }),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    trustedOrigins: TRUSTED_ORIGINS,
    session: { expiresIn: EXPIRES_IN, updateAge: UPDATE_AGE },
    basePath: BASE_PATH,
    plugins: [
      bearer(),
      jwt({
        jwt: {
          issuer: BETTER_AUTH_URL,
          audience: BETTER_AUTH_URL,
          expirationTime: JWT_EXPIRATION_TIME,
        },
      }),
    ],
  });

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth(db);

export const JWKS_PATH = '/jwks';
export const JWKS_URL = new URL(path.join(BETTER_AUTH_URL, BASE_PATH, JWKS_PATH));
