import type { GetRecordValues } from '../utils/type-utils.js';

export type StatusCode = GetRecordValues<typeof STATUS_CODES>;

export const STATUS_CODES = {
  BAD_REQUEST: 400,
} as const;
