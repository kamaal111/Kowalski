import { drizzle } from 'drizzle-orm/node-postgres';

import env from '../api/env.js';
import * as schema from './schema/better-auth.js';
import * as exchangeRateSchema from './schema/exchange-rates.js';
import * as stocksSchema from './schema/stocks.js';
import * as portfolioSchema from './schema/portfolio.js';

const { DATABASE_URL } = env;

export type Database = typeof db;

const db = drizzle(DATABASE_URL, { schema: { ...schema, ...exchangeRateSchema, ...stocksSchema, ...portfolioSchema } });

export default db;
