import type { Context, Next } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';

import type { Auth } from '../auth/better-auth.js';
import type { Database } from '../db/index.js';

interface InjectedContext {
  db: Database;
  auth: Auth;
}

export type HonoVariables = RequestIdVariables & InjectedContext;

export interface HonoEnvironment {
  Variables: HonoVariables;
}

export function injectRequestContext({ db, auth }: InjectedContext) {
  return async (c: Context<HonoEnvironment>, next: Next) => {
    c.set('db', db);
    c.set('auth', auth);
    await next();
  };
}
