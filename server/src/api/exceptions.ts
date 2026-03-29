import { HTTPException } from 'hono/http-exception';
import type * as z from 'zod';

import type { HonoContext } from './contexts';
import { STATUS_CODES, type StatusCode } from '../constants/http';

export class APIException extends HTTPException {
  readonly context?: unknown;

  constructor(
    c: HonoContext,
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
    this.context = options.context;
  }
}

export class InvalidPayload extends APIException {
  constructor(c: HonoContext, options?: { message?: string; context?: unknown }) {
    super(c, STATUS_CODES.BAD_REQUEST, {
      message: options?.message ?? 'Invalid payload',
      code: 'INVALID_PAYLOAD',
      context: options?.context,
    });
  }
}

export class InvalidValidation extends InvalidPayload {
  constructor(c: HonoContext, validationError: z.ZodError) {
    super(c, { context: { validations: validationError.issues } });
  }
}

export class NotFound extends APIException {
  constructor(c: HonoContext, options?: { message?: string }) {
    super(c, STATUS_CODES.NOT_FOUND, {
      message: options?.message ?? 'Not found',
      code: 'NOT_FOUND',
    });
  }
}

export class Unauthorized extends APIException {
  constructor(c: HonoContext, options?: { message?: string }) {
    super(c, STATUS_CODES.UNAUTHORIZED, {
      message: options?.message ?? 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }
}
