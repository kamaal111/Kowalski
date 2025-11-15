import { char, type PgCharBuilderInitial } from 'drizzle-orm/pg-core';

function currency(name: string): PgCharBuilderInitial<string, [string, ...string[]], 3> {
  return char(name, { length: 3 });
}

export default currency;
