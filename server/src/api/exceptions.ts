import type { StandardSchemaV1 } from '@standard-schema/spec';
import { HTTPException } from 'hono/http-exception';
import type { HonoContext } from './contexts.ts';
import { STATUS_CODES, type StatusCode } from '../constants/http.ts';

type ExceptionContext = Pick<HonoContext, 'get'>;

export class APIException extends HTTPException {
  readonly context?: unknown;
  readonly code: string;

  constructor(
    c: ExceptionContext,
    statusCode: StatusCode,
    options: { message: string; code: string; headers?: Headers; context?: unknown },
  ) {
    const headers = options.headers ?? new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Request-Id', c.get('requestId'));

    const response = new Response(
      JSON.stringify({ message: options.message, code: options.code, context: options.context }),
      { status: statusCode, headers },
    );
    super(statusCode, { res: response, message: options.message });
    this.code = options.code;
    this.context = options.context;
  }
}

export class InvalidPayload extends APIException {
  constructor(c: ExceptionContext, options?: { message?: string; context?: unknown }) {
    super(c, STATUS_CODES.BAD_REQUEST, {
      message: options?.message ?? 'Invalid payload',
      code: 'INVALID_PAYLOAD',
      context: options?.context,
    });
  }
}

export class InvalidValidation extends InvalidPayload {
  declare readonly context: { validations: readonly StandardSchemaV1.Issue[] };

  constructor(c: ExceptionContext, issues: readonly StandardSchemaV1.Issue[]) {
    super(c, { context: { validations: issues } });
  }
}

export class NotFound extends APIException {
  constructor(c: ExceptionContext, options?: { message?: string }) {
    super(c, STATUS_CODES.NOT_FOUND, {
      message: options?.message ?? 'Not found',
      code: 'NOT_FOUND',
    });
  }
}

export class Unauthorized extends APIException {
  constructor(c: ExceptionContext, options?: { message?: string }) {
    super(c, STATUS_CODES.UNAUTHORIZED, {
      message: options?.message ?? 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }
}
