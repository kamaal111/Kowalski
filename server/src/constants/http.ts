import type { GetRecordValues } from '../utils/type-utils.js';

export type StatusCode = GetRecordValues<typeof STATUS_CODES>;

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  LOCKED: 423,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpMethod = GetRecordValues<typeof HTTP_METHODS>;

export const HTTP_METHODS = {
  POST: 'POST',
} as const;
