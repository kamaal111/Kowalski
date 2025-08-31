import type { Next } from 'hono';
import { logger as honoLoggerMiddleware } from 'hono/logger';

import type { HonoContext } from '../api/contexts.js';

function loggingMiddleware(c: HonoContext, next: Next) {
  return honoLoggerMiddleware((str: string, ...rest: string[]) => {
    console.log(c.get('requestId'), str, rest.join(''));
  })(c, next);
}

export function makeUncaughtErrorLog(c: HonoContext, err: unknown) {
  console.error(`${c.req.method} ${c.req.path} Uncaught exception; request-id: ${c.get('requestId')}; ${String(err)}`);
}

export default loggingMiddleware;
