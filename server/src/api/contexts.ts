import type { Context, Input, Next } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';

import type { Database } from '../db';
import type { Auth, SessionResponse } from '../auth';

interface InjectedContext {
  db: Database;
  auth: Auth;
}

export type HonoVariables = RequestIdVariables & InjectedContext & { session?: SessionResponse };

export interface HonoEnvironment {
  Variables: HonoVariables;
}

export type HonoContext<P extends string = string, I extends Input = Record<string, unknown>> = Context<
  HonoEnvironment,
  P,
  I
>;

export function injectRequestContext({ db, auth }: InjectedContext) {
  return async (c: HonoContext, next: Next) => {
    c.set('db', db);
    c.set('auth', auth);
    await next();
  };
}
