import type { Context, Next } from 'hono';
import { logger as honoLoggerMiddleware } from 'hono/logger';

import type { HonoEnvironment } from '../api/contexts.js';

function loggingMiddleware(c: Context<HonoEnvironment>, next: Next) {
  return honoLoggerMiddleware((str: string, ...rest: string[]) => {
    console.log(c.get('requestId'), str, rest.join(''));
  })(c as Context<HonoEnvironment, string, object>, next);
}

export function makeUncaughtErrorLog(c: Context<HonoEnvironment>, err: unknown) {
  console.error(`${c.req.method} ${c.req.path} Uncaught exception; request-id: ${c.get('requestId')}; ${String(err)}`);
}

export default loggingMiddleware;
