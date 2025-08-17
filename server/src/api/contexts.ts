import type { Context, Next } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';

export type DatabaseType = NodePgDatabase<typeof schema>;

export type HonoVariables = RequestIdVariables & {
  db: DatabaseType;
};

export type HonoEnvironment = { Variables: HonoVariables };

export function injectRequestContext({ db }: { db: DatabaseType }) {
  return async (c: Context<HonoEnvironment>, next: Next) => {
    c.set('db', db);
    await next();
  };
}
