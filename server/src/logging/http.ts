import type { HonoContext } from '@/api/contexts';
import type { ServerMode } from '@/api/env';
import env from '@/api/env';
import { childLogger, createRequestLogger, type LogBindings, type ServerLogger } from '@/logging';

export function initializeRequestLogger(c: HonoContext, mode: ServerMode) {
  const logger = createRequestLogger({
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
    route: c.req.path,
    mode,
  });

  c.set('logger', logger);
  return logger;
}

export function getRequestLogger(c: HonoContext) {
  const existingLogger = c.get('logger') ?? initializeRequestLogger(c, env.MODE);
  return bindAuthenticatedUserIdFromContext(c, existingLogger);
}

function bindRequestLogger(c: HonoContext, bindings: LogBindings) {
  const logger = childLogger(getRequestLogger(c), bindings);
  c.set('logger', logger);

  return logger;
}

export function withRequestLogger(c: HonoContext, bindings: LogBindings) {
  return childLogger(getRequestLogger(c), bindings);
}

export function setRequestUserId(c: HonoContext, userId: string) {
  return bindRequestLogger(c, { user_id: userId });
}

export function setRequestRoute(c: HonoContext, route: string) {
  return bindRequestLogger(c, { route });
}

export function getRouteForLog(c: HonoContext) {
  const logger = getRequestLogger(c);
  const bindings = getLoggerBindings(logger);
  const route = bindings.route;

  return typeof route === 'string' && route.length > 0 ? route : c.req.path;
}

export function markRequestFailed(c: HonoContext) {
  c.set('requestFailed', true);
}

export function hasRequestFailed(c: HonoContext) {
  return c.get('requestFailed') === true;
}

function getLoggerBindings(logger: ServerLogger): Record<string, unknown> {
  const bindings = logger.bindings();
  return bindings != null && typeof bindings === 'object' ? bindings : {};
}

function bindAuthenticatedUserIdFromContext(c: HonoContext, logger: ServerLogger) {
  const existingUserId = getLoggerBindings(logger).user_id;
  if (typeof existingUserId === 'string' && existingUserId.length > 0) {
    return logger;
  }

  const session = c.get('session');
  const userId = session?.user.id;
  if (typeof userId !== 'string' || userId.length === 0) {
    return logger;
  }

  const loggerWithUserId = childLogger(logger, { user_id: userId });
  c.set('logger', loggerWithUserId);

  return loggerWithUserId;
}
