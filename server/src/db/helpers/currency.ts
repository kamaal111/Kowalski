import { char } from 'drizzle-orm/pg-core';

function currency(name: string) {
  return char(name, { length: 3 });
}

export default currency;
