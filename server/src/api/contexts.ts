import type { AuthVariables } from '@kamaalio/kamaal-auth-hono';
import type { Context, Input, Next } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';

import type { Database } from '../db/index.ts';
import type { Auth } from '../auth/index.ts';
import type { ServerLogger } from '../logging/index.ts';

interface InjectedContext {
  db: Database;
  auth: Auth;
}

interface LoggingVariables {
  logger: ServerLogger;
}

export type HonoVariables = RequestIdVariables & InjectedContext & LoggingVariables & AuthVariables;

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
