import { HTTPException } from 'hono/http-exception';
import type { ErrorHandler, Next } from 'hono';
import type { HonoContext, HonoEnvironment } from '@/api/contexts';

import { APIException, InvalidValidation } from '@/api/exceptions';
import env from '@/api/env';
import { STATUS_CODES } from '@/constants/http';
import { logError, logInfo, logWarn } from '@/logging';
import {
  getRequestLogger,
  getRouteForLog,
  hasRequestFailed,
  initializeRequestLogger,
  markRequestFailed,
} from '@/logging/http';

function loggingMiddleware(c: HonoContext, next: Next) {
  const logger = initializeRequestLogger(c, env.MODE);
  const startedAt = performance.now();

  logInfo(logger, { event: 'request.started' });

  return next().then(() => {
    if (hasRequestFailed(c)) {
      return;
    }

    logInfo(getRequestLogger(c), {
      event: 'request.completed',
      route: getRouteForLog(c),
      status_code: c.res.status,
      duration_ms: roundDurationMs(performance.now() - startedAt),
      outcome: c.res.status >= STATUS_CODES.BAD_REQUEST ? 'failure' : 'success',
    });
  });
}

export const handleServerError = ((err, ctx: HonoContext) => {
  const logger = getRequestLogger(ctx);

  if (err instanceof InvalidValidation) {
    const validationIssues = getValidationIssues(err.context);
    logWarn(logger, {
      event: 'request.validation.failed',
      route: getRouteForLog(ctx),
      status_code: err.status,
      outcome: 'failure',
      error_code: 'INVALID_PAYLOAD',
      error_name: err.name,
      validation_issue_count: validationIssues.length,
      validation_issue_paths: getValidationIssuePaths(validationIssues),
    });

    return jsonExceptionResponse(err);
  }

  if (err instanceof APIException) {
    logWarn(logger, {
      event: 'request.error',
      route: getRouteForLog(ctx),
      status_code: err.status,
      outcome: 'failure',
      error_code: err.code,
      error_name: err.name,
    });

    return jsonExceptionResponse(err);
  }

  if (err instanceof HTTPException) {
    logWarn(logger, {
      event: 'request.error',
      route: getRouteForLog(ctx),
      status_code: err.status,
      outcome: 'failure',
      error_name: err.name,
    });

    return jsonExceptionResponse(err);
  }

  markRequestFailed(ctx);
  logError(
    logger,
    {
      event: 'request.failed',
      route: getRouteForLog(ctx),
      status_code: STATUS_CODES.INTERNAL_SERVER_ERROR,
      outcome: 'failure',
      error_code: 'INTERNAL_SERVER_ERROR',
    },
    err,
  );

  return ctx.json(
    { message: 'Something went wrong', code: 'INTERNAL_SERVER_ERROR' },
    STATUS_CODES.INTERNAL_SERVER_ERROR,
  );
}) satisfies ErrorHandler<HonoEnvironment>;

export default loggingMiddleware;

function jsonExceptionResponse(err: HTTPException) {
  return err.getResponse();
}

function getValidationIssuePaths(validations: ValidationIssue[]) {
  return validations.map(issue => {
    if (issue == null || typeof issue !== 'object' || !('path' in issue) || !Array.isArray(issue.path)) {
      return '<root>';
    }

    const path = issue.path.map((segment: string | number) => String(segment)).join('.');
    return path.length > 0 ? path : '<root>';
  });
}

function roundDurationMs(durationMs: number) {
  return Math.round(durationMs * 100) / 100;
}

interface ValidationIssue {
  path?: (string | number)[];
}

function getValidationIssues(context: unknown): ValidationIssue[] {
  if (context == null || typeof context !== 'object' || !('validations' in context)) {
    return [];
  }

  const validations = context.validations;
  return Array.isArray(validations) ? validations.filter(isValidationIssue) : [];
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  if (!('path' in value) || value.path == null) {
    return true;
  }

  return (
    Array.isArray(value.path) && value.path.every(segment => typeof segment === 'string' || typeof segment === 'number')
  );
}
