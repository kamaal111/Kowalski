import { HTTPException } from 'hono/http-exception';
import type * as z from 'zod';

import type { HonoContext } from './contexts.js';
import { STATUS_CODES, type StatusCode } from '../constants/http.js';

export class APIException extends HTTPException {
  readonly c: HonoContext;

  constructor(c: HonoContext, statusCode: StatusCode, options: { message: string; code?: string; headers?: Headers }) {
    const response = new Response(JSON.stringify({ message: options.message, code: options.code }), {
      status: statusCode,
      headers: options.headers ?? { 'Content-Type': 'application/json' },
    });
    super(statusCode, { res: response });
    this.c = c;
  }
}

export class InvalidPayload extends APIException {
  readonly validationError: z.ZodError;

  constructor(c: HonoContext, validationError: z.ZodError) {
    super(c, STATUS_CODES.BAD_REQUEST, { message: 'Invalid payload' });

    this.validationError = validationError;
  }
}
