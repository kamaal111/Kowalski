export const APP_API_BASE_PATH = '/app-api';
export const DAILY_API_BASE_PATH = '/daily-api';

export const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const ONE_SECOND_IN_MILLISECONDS = 1000;
export const ONE_MINUTE_IN_MILLISECONDS = 60 * ONE_SECOND_IN_MILLISECONDS;

export const REQUEST_ID_HEADER_NAME = 'kowalski-request-id';

export type ResolvedtransactionType = (typeof RESOLVED_TRANSACTION_TYPE_ARRAY)[number];

export const RESOLVED_TRANSACTION_TYPES: { [Key in Uppercase<ResolvedtransactionType>]: Lowercase<Key> } = {
  BUY: 'buy',
  SELL: 'sell',
};

export const RESOLVED_TRANSACTION_TYPE_ARRAY = ['buy', 'sell'] as const;

export type TransactionType = (typeof TRANSACTION_TYPE_ARRAY)[number];

export const TRANSACTION_TYPES: { [Key in Uppercase<TransactionType>]: Lowercase<Key> } = {
  BUY: 'buy',
  SELL: 'sell',
  SPLIT: 'split',
};

export const TRANSACTION_TYPE_ARRAY = [...RESOLVED_TRANSACTION_TYPE_ARRAY, 'split'] as const;
