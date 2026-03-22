import { afterAll, beforeAll, vi } from 'vitest';

import type { Database } from '../db/index.js';
import { createApp } from '../index.js';
import { createTestDatabase, createTestUserAndSession } from './utils.js';

export let db: Database;
export let app: ReturnType<typeof createApp>;
export let sessionToken: string;

let databaseCleanUp: () => Promise<void>;

// We don't need have any context, but we are required to destructure the first param of beforeAll
// eslint-disable-next-line no-empty-pattern
beforeAll(async ({}, suite) => {
  databaseCleanUp = await setupDatabase(suite.name);
});

afterAll(async () => {
  await databaseCleanUp();
});

async function setupDatabase(suiteName: string): Promise<() => Promise<void>> {
  const isIntegrationTest = suiteName.endsWith('integration.test.ts');
  if (!isIntegrationTest) return () => Promise.resolve();

  const setup = await createTestDatabase();
  db = setup.db;
  app = createApp(db);

  const { token } = await createTestUserAndSession(db);
  sessionToken = token;

  return setup.cleanup;
}

const QUOTES = [
  {
    symbol: 'AAPL',
    shortname: 'Apple Inc.',
    longname: 'Apple Inc.',
    exchange: 'NMS',
    quoteType: 'EQUITY',
    isYahooFinance: true,
  },
];

vi.mock('yahoo-finance2', () => {
  return {
    default: class YahooFinance {
      search = vi.fn().mockImplementation(async (query: string) => {
        return Promise.resolve({ quotes: QUOTES.filter(quote => quote.symbol.includes(query)) });
      });
      quote = vi.fn().mockResolvedValue({
        symbol: 'AAPL',
        regularMarketPrice: 150.0,
        currency: 'USD',
      });
    },
  };
});
