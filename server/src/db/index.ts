import { drizzle } from 'drizzle-orm/node-postgres';

import env from '../api/env.js';
import * as schema from './schema.js';

const { DATABASE_URL } = env;

export type Database = typeof db;

const db = drizzle(DATABASE_URL, { schema });

export default db;
