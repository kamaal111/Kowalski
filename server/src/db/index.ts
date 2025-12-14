import { drizzle } from 'drizzle-orm/node-postgres';

import env from '../api/env.js';
import schema from './schema/index.js';

const { DATABASE_URL, DEBUG } = env;

export type Database = typeof db;

const db = drizzle(DATABASE_URL, { schema, logger: DEBUG });

export default db;
