import { Writable } from 'node:stream';

import pino from 'pino';
import type { DestinationStream, LevelWithSilent, Logger, LoggerOptions } from 'pino';

import env from '../api/env.ts';
import type { ServerMode } from '../api/env.ts';
import { describeRuntimeType, isBoolean, isNumber, isPrimitiveLogValue, isString } from '../utils/type-guards.ts';

const SERVICE_NAME = 'kowalski-server';
const DEFAULT_COMPONENT = 'server';
const REQUEST_COMPONENT = 'http';

type LogScalar = boolean | number | string | null | undefined;
type LogArray = LogScalar[];
type LogValue = LogScalar | LogArray;
export type LogBindings = Record<string, LogValue | undefined>;

interface BaseLogFields {
  event: string;
  mode?: ServerMode;
  outcome?: 'failure' | 'success';
  request_id?: string;
  method?: string;
  path?: string;
  url?: string;
  route?: string;
  status_code?: number;
  duration_ms?: number;
  user_id?: string;
  error_code?: string;
  error_name?: string;
  cache_status?: 'hit' | 'miss' | 'set' | 'skip';
  result_count?: number;
  stored_count?: number;
  transaction_type?: string;
}

type LogFields = BaseLogFields & LogBindings;

type LogMethod = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

interface CreateLoggerOptions {
  destination?: DestinationStream;
  level?: LevelWithSilent;
  mode?: ServerMode;
  pretty?: boolean;
}

let rootLogger = createServerLogger();

export type ServerLogger = Logger;

export function resetRootLogger() {
  rootLogger = createServerLogger();
}

export function setRootLoggerDestination(destination: DestinationStream) {
  rootLogger = createServerLogger({ destination, pretty: false });
}

export function getComponentLogger(component: string) {
  return childLogger(rootLogger, { component });
}

export function createRequestLogger(fields: {
  requestId: string;
  method: string;
  path: string;
  url: string;
  route: string;
  mode: ServerMode;
}) {
  return childLogger(rootLogger, {
    component: REQUEST_COMPONENT,
    request_id: fields.requestId,
    method: fields.method,
    path: fields.path,
    url: fields.url,
    route: fields.route,
    mode: fields.mode,
  });
}

export function childLogger(logger: ServerLogger, bindings: LogBindings) {
  return logger.child(sanitizeLogRecord(bindings));
}

export function logEvent(logger: ServerLogger, level: LogMethod, fields: LogFields, message?: string) {
  logger[level](sanitizeLogRecord(fields), message);
}

export function logInfo(logger: ServerLogger, fields: LogFields, message?: string) {
  logEvent(logger, 'info', fields, message);
}

export function logWarn(logger: ServerLogger, fields: LogFields, message?: string) {
  logEvent(logger, 'warn', fields, message);
}

export function logError(
  logger: ServerLogger,
  fields: LogFields,
  cause?: unknown,
  message?: string,
  level: Extract<LogMethod, 'error' | 'fatal'> = 'error',
) {
  const errorFields = cause == null ? undefined : serializeError(cause);
  const mergedFields = errorFields == null ? fields : { ...fields, ...errorFields };
  logger[level](sanitizeLogRecord(mergedFields), message);
}

function serializeError(cause: unknown): LogBindings | undefined {
  if (cause == null) {
    return undefined;
  }

  if (cause instanceof Error) {
    return {
      error_name: cause.constructor.name || cause.name,
      error_message: cause.message,
      error_stack: cause.stack,
      error_cause_name: getErrorCauseName(cause),
      error_cause_message: getErrorCauseMessage(cause),
    };
  }

  return {
    error_name: describeRuntimeType(cause),
    error_details: isPrimitiveLogValue(cause) ? `${cause}` : 'Non-Error value thrown',
  };
}

function createServerLogger(options: CreateLoggerOptions = {}) {
  const destination = options.destination ?? createDestination(options.pretty ?? env.DEBUG);
  const loggerOptions = createLoggerOptions(options.level ?? env.LOG_LEVEL, options.mode ?? env.MODE);

  return pino(loggerOptions, destination);
}

function createLoggerOptions(level: LevelWithSilent, mode: ServerMode): LoggerOptions {
  return {
    level,
    base: {
      service: SERVICE_NAME,
      component: DEFAULT_COMPONENT,
      mode,
    },
    redact: {
      paths: [
        'authorization',
        'Authorization',
        'cookie',
        'Cookie',
        'cookies',
        'req.headers.authorization',
        'req.headers.Authorization',
        'req.headers.cookie',
        'req.headers.Cookie',
        'headers.authorization',
        'headers.Authorization',
        'headers.cookie',
        'headers.Cookie',
        'response.headers.set-cookie',
        'response.headers.Set-Cookie',
        'jwt',
        'token',
        'sessionToken',
        'accessToken',
        'refreshToken',
        'body',
        'request.body',
        'response.body',
      ],
      censor: '[Redacted]',
    },
  };
}

function createDestination(pretty: boolean) {
  if (pretty) {
    return pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
      },
    });
  }

  return pino.destination({ sync: true });
}

export function createMemoryLogDestination(logs: string[]) {
  return new Writable({
    write(chunk: string | Uint8Array, _encoding, callback) {
      logs.push(isString(chunk) ? chunk : Buffer.from(chunk).toString('utf8'));
      callback();
    },
  });
}

function sanitizeLogRecord(record: LogBindings): LogBindings {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, sanitizeLogValue(value)]));
}

function sanitizeLogValue(value: LogValue | undefined): LogValue | undefined {
  if (value == null || isString(value) || isNumber(value) || isBoolean(value)) {
    return value;
  }

  const sanitizedItems = value.flatMap(item => {
    const sanitizedItem = sanitizeArrayItem(item);
    return sanitizedItem === undefined ? [] : [sanitizedItem];
  });

  return sanitizedItems.length > 0 ? sanitizedItems : undefined;
}

function sanitizeArrayItem(value: LogScalar): LogScalar | undefined {
  if (value == null || isString(value) || isNumber(value) || isBoolean(value)) {
    return value;
  }

  return undefined;
}

function getErrorCauseName(error: Error): string | undefined {
  const cause = error.cause;
  if (cause == null) {
    return undefined;
  }

  if (cause instanceof Error) {
    return cause.constructor.name || cause.name;
  }

  return describeRuntimeType(cause);
}

function getErrorCauseMessage(error: Error): string | undefined {
  const cause = error.cause;
  if (cause == null) {
    return undefined;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (isPrimitiveLogValue(cause)) {
    return cause.toString();
  }

  return undefined;
}
