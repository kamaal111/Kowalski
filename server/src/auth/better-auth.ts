import path from 'node:path';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { APP_API_BASE_PATH, ONE_DAY_IN_SECONDS } from '../constants/common.js';
import { ROUTE_NAME } from './constants.js';
import db from '../db/index.js';
import env from '../api/env.js';

export type Auth = ReturnType<typeof betterAuth>;

const { BETTER_AUTH_SESSION_UPDATE_AGE_DAYS, BETTER_AUTH_SESSION_EXPIRY_DAYS } = env;
const EXPIRES_IN = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_EXPIRY_DAYS;
const UPDATE_AGE = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_UPDATE_AGE_DAYS;
const BASE_PATH = path.join(APP_API_BASE_PATH, ROUTE_NAME);
const TRUSTED_ORIGINS = ['kowalski://'];

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  trustedOrigins: TRUSTED_ORIGINS,
  session: { expiresIn: EXPIRES_IN, updateAge: UPDATE_AGE },
  basePath: BASE_PATH,
  plugins: [bearer()],
}) as Auth;
