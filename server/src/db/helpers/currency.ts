import { char } from 'drizzle-orm/pg-core';

function currency(name: string) {
  // Shared 3-letter ISO 4217 currency code used by portfolio prices and FX rates.
  return char(name, { length: 3 });
}

export default currency;
