import { drizzle } from 'drizzle-orm/node-postgres';

import { createDatabaseQueryLogger } from './logging.ts';
import { appRelations } from './schema/index.ts';
import env from '../api/env.ts';

const { DATABASE_URL, DEBUG } = env;

export type Database = typeof db;

const db = drizzle<typeof appRelations>(DATABASE_URL, {
  relations: appRelations,
  logger: DEBUG ? createDatabaseQueryLogger() : false,
});

export default db;
