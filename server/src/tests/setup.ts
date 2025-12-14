import { afterAll, beforeAll, vi } from 'vitest';

import type { Database } from '../db/index.js';
import { createApp } from '../index.js';
import { createTestDatabase, createTestUserAndSession } from './utils.js';

export let db: Database;
export let app: ReturnType<typeof createApp>;
export let sessionToken: string;

let cleanup: () => Promise<void>;

beforeAll(async suite => {
  const isIntegrationTest = suite.name.endsWith('integration.test.ts');
  if (!isIntegrationTest) return;

  const setup = await createTestDatabase();
  db = setup.db;
  cleanup = setup.cleanup;
  app = createApp(db);

  const { token } = await createTestUserAndSession(db);
  sessionToken = token;
});

afterAll(async () => {
  if (cleanup) {
    await cleanup();
  }
});

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
