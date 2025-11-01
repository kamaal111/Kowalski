import type { Next } from 'hono';
import { logger as honoLoggerMiddleware } from 'hono/logger';

import type { HonoContext } from '../api/contexts.js';

function logConstructor(c: HonoContext, str: string, ...rest: string[]) {
  return [c.get('requestId'), str, rest.join('')].join(' ');
}

export function errorLogger(c: HonoContext, str: string, ...rest: string[]) {
  console.error(logConstructor(c, str, ...rest));
}

export function logger(c: HonoContext, str: string, ...rest: string[]) {
  console.log(logConstructor(c, str, ...rest));
}

function loggingMiddleware(c: HonoContext, next: Next) {
  return honoLoggerMiddleware((str: string, ...rest: string[]) => {
    logger(c, str, ...rest);
  })(c, next);
}

export function makeUncaughtErrorLog(c: HonoContext, err: unknown) {
  errorLogger(c, `${c.req.method} ${c.req.path} Uncaught exception; ${String(err)}`);
}

export default loggingMiddleware;
