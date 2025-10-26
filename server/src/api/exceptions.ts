import { HTTPException } from 'hono/http-exception';
import type * as z from 'zod';

import type { HonoContext } from './contexts.js';
import { STATUS_CODES, type StatusCode } from '../constants/http.js';

export class APIException extends HTTPException {
  readonly c: HonoContext;

  constructor(
    c: HonoContext,
    statusCode: StatusCode,
    options: { message: string; code?: string; headers?: Headers; context?: unknown },
  ) {
    const response = new Response(
      JSON.stringify({
        message: options.message,
        code: options.code,
        context: options.context,
      }),
      {
        status: statusCode,
        headers: options.headers ?? { 'Content-Type': 'application/json' },
      },
    );
    super(statusCode, { res: response });
    this.c = c;
  }
}

export class InvalidPayload extends APIException {
  constructor(c: HonoContext, options?: { message?: string; context?: unknown }) {
    super(c, STATUS_CODES.BAD_REQUEST, {
      message: options?.message ?? 'Invalid payload',
      code: 'INVALID_PAYLOAD',
    });
  }
}

export class InvalidValidation extends InvalidPayload {
  readonly validationError: z.ZodError;

  constructor(c: HonoContext, validationError: z.ZodError) {
    super(c);

    this.validationError = validationError;
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
