import { drizzle } from 'drizzle-orm/node-postgres';

import env from '../api/env.ts';
import { appRelations } from './schema/index.ts';

const { DATABASE_URL, DEBUG } = env;

export type Database = typeof db;

const db = drizzle<typeof appRelations>(DATABASE_URL, { relations: appRelations, logger: DEBUG });

export default db;
