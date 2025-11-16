import type { GetRecordValues } from '../utils/type-utils.js';

export type StatusCode = GetRecordValues<typeof STATUS_CODES>;

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LOCKED: 423,
  INTERNAL_SERVER_ERROR: 500,
} as const;
