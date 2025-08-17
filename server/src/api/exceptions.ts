import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type * as z from 'zod';

import type { HonoEnvironment } from './contexts.js';
import { STATUS_CODES, type StatusCode } from '../constants/http.js';

export class APIException extends HTTPException {
  readonly c: Context<HonoEnvironment>;

  constructor(c: Context<HonoEnvironment>, statusCode: StatusCode, options: { message: string }) {
    super(statusCode, { message: options.message });
    this.c = c;
  }
}

export class InvalidPayload extends APIException {
  readonly validationError: z.ZodError;

  constructor(c: Context<HonoEnvironment>, validationError: z.ZodError) {
    super(c, STATUS_CODES.BAD_REQUEST, { message: 'Invalid payload' });

    this.validationError = validationError;
  }
}
