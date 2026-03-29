import type { Next } from 'hono';
import { logger as honoLoggerMiddleware } from 'hono/logger';

import type { HonoContext } from '../api/contexts';

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
  const logLines = [
    `${c.req.method} ${c.req.path} Uncaught exception; ${describeError(err)}`,
    ...collectErrorDetails(err),
  ];

  errorLogger(c, logLines.join('\n'));
}

export default loggingMiddleware;

function describeError(err: unknown) {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }

  return String(err);
}

function collectErrorDetails(err: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (!(err instanceof Error) || seen.has(err)) {
    return [];
  }

  seen.add(err);

  const details: string[] = [];
  const labelPrefix = depth === 0 ? 'Error' : `Cause ${depth}`;

  if (err.stack != null) {
    details.push(`${labelPrefix} stack:\n${indentMultiline(err.stack, '  ')}`);
  }

  if (err.cause !== undefined) {
    details.push(`Cause ${depth + 1}: ${describeError(err.cause)}`);
    details.push(...collectErrorDetails(err.cause, seen, depth + 1));
  }

  return details;
}

function indentMultiline(value: string, indentation: string) {
  return value
    .split('\n')
    .map(line => `${indentation}${line}`)
    .join('\n');
}
