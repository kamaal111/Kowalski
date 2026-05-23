import z from 'zod';

export const ROUTE_NAME = '/forex';
export const OPENAPI_TAG = 'Forex';

export const BASE_CURRENCY = 'EUR';

export const CURRENCIES = [
  BASE_CURRENCY,
  'USD',
  'JPY',
  'BGN',
  'CYP',
  'CZK',
  'DKK',
  'EEK',
  'GBP',
  'HUF',
  'LTL',
  'LVL',
  'MTL',
  'PLN',
  'ROL',
  'RON',
  'SEK',
  'SIT',
  'SKK',
  'CHF',
  'ISK',
  'ILS',
  'NOK',
  'HRK',
  'RUB',
  'TRL',
  'TRY',
  'AUD',
  'BRL',
  'CAD',
  'CNY',
  'HKD',
  'IDR',
  'INR',
  'KRW',
  'MXN',
  'MYR',
  'NZD',
  'PHP',
  'SGD',
  'THB',
  'ZAR',
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_PREFERRED_CURRENCY: Currency = 'USD';

export const CURRENCY_SET: ReadonlySet<string> = new Set(CURRENCIES);

export const CurrencyShape = z.enum(CURRENCIES).openapi('Currency', {
  description: 'Supported ISO 4217 currency code',
  example: 'USD',
});
