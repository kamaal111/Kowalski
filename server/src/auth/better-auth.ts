import path from 'node:path';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { APP_API_BASE_PATH } from '../constants/common.js';
import db from '../db/index.js';
import env from '../api/env.js';

export type Auth = ReturnType<typeof betterAuth>;

const { BETTER_AUTH_SESSION_UPDATE_AGE_DAYS, BETTER_AUTH_SESSION_EXPIRY_DAYS } = env;
const BASE_PATH = path.join(APP_API_BASE_PATH, 'auth');

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  trustedOrigins: ['kowalski://'],
  session: {
    expiresIn: 60 * 60 * 24 * BETTER_AUTH_SESSION_EXPIRY_DAYS,
    updateAge: 60 * 60 * 24 * BETTER_AUTH_SESSION_UPDATE_AGE_DAYS,
  },
  basePath: BASE_PATH,
  plugins: [bearer()],
}) as Auth;
