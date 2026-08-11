import { structuredLogger } from '@hono/structured-logger';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import env from '../api/env.ts';
import type { HonoContext, HonoEnvironment } from '../api/contexts.ts';
import { APIException, InvalidValidation } from '../api/exceptions.ts';
import { STATUS_CODES } from '../constants/http.ts';
import { createRequestLogger, logError, logInfo, logWarn, type ServerLogger } from '../logging/index.ts';
import { getRequestLogger, getRouteForLog } from '../logging/http.ts';

function loggingMiddleware() {
  return structuredLogger<HonoEnvironment, ServerLogger>({
    createLogger: c =>
      createRequestLogger({
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        url: c.req.url,
        route: getRouteForLog(c),
        mode: env.MODE,
      }),
    onRequest: (_logger, c) => {
      logInfo(getRequestLogger(c), { event: 'request.started' });
    },
    onResponse: (_logger, c, elapsedMs) => {
      logInfo(getRequestLogger(c), {
        event: 'request.completed',
        route: getRouteForLog(c),
        status_code: c.res.status,
        duration_ms: roundDurationMs(elapsedMs),
        outcome: c.res.status >= STATUS_CODES.BAD_REQUEST ? 'failure' : 'success',
      });
    },
    onError: (_logger, error, c, elapsedMs) => {
      const { level, fields, message } = describeError(error);
      const logger = getRequestLogger(c);
      const shared = {
        route: getRouteForLog(c),
        status_code: c.res.status,
        duration_ms: roundDurationMs(elapsedMs),
        outcome: 'failure' as const,
      };

      if (level === 'error') {
        logError(logger, { ...fields, ...shared }, error, message);
        return;
      }

      logWarn(logger, { ...fields, ...shared }, message);
    },
  });
}

/** Silent by design: `loggingMiddleware`'s `onError` owns failure logging. */
export const handleServerError = ((err, ctx: HonoContext) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return ctx.json(
    { message: 'Something went wrong', code: 'INTERNAL_SERVER_ERROR' },
    STATUS_CODES.INTERNAL_SERVER_ERROR,
  );
}) satisfies ErrorHandler<HonoEnvironment>;

export default loggingMiddleware;

function describeError(error: Error) {
  if (error instanceof InvalidValidation) {
    const validationIssues = error.context.validations;

    return {
      level: 'warn' as const,
      fields: {
        event: 'request.validation.failed',
        error_code: error.code,
        error_name: error.name,
        validation_issue_count: validationIssues.length,
        validation_issue_paths: validationIssues.map(issue => {
          const path = (issue.path ?? []).map(formatValidationPathSegment).join('.');

          return path.length > 0 ? path : '<root>';
        }),
      },
      message: 'Request validation failed.',
    };
  }

  if (error instanceof APIException) {
    return {
      level: 'warn' as const,
      fields: { event: 'request.error', error_code: error.code, error_name: error.name },
      message: 'Request failed with an expected application error.',
    };
  }

  if (error instanceof HTTPException) {
    return {
      level: 'warn' as const,
      fields: { event: 'request.error', error_code: 'HTTP_ERROR', error_name: error.name },
      message: 'Request failed with an HTTP error.',
    };
  }

  return {
    level: 'error' as const,
    fields: { event: 'request.failed', error_code: 'INTERNAL_SERVER_ERROR' },
    message: 'Request failed with an unexpected server error.',
  };
}

function formatValidationPathSegment(segment: PropertyKey | StandardSchemaV1.PathSegment) {
  if (typeof segment === 'object') {
    return String(segment.key);
  }

  return String(segment);
}

function roundDurationMs(durationMs: number) {
  return Math.round(durationMs * 100) / 100;
}
