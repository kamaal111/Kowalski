import { sql } from 'drizzle-orm';
import { describe, expect, vi } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { ListEntriesResponseSchema } from '../schemas/responses';
import { seedPortfolioEntry } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import { ErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { createTestUserAndSession } from '@/tests/utils';

const LIST_ENTRIES_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entries`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('List Portfolio Entries Route', () => {
  integrationTest(
    'returns seeded entries in newest transaction order with updated-at tiebreakers',
    async ({ app, db, sessionToken, userId }) => {
      const oldestEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'MSFT',
          exchange: 'NMS',
          name: 'Microsoft Corporation',
          sector: 'Technology',
          industry: 'Software - Infrastructure',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 4,
        purchasePrice: { currency: 'USD', value: 320.25 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
        createdAt: new Date('2025-12-19T12:00:00.000Z'),
        updatedAt: new Date('2025-12-19T12:00:00.000Z'),
      });
      const earlierUpdatedEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150.5 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
        createdAt: new Date('2025-12-20T12:00:00.000Z'),
        updatedAt: new Date('2025-12-20T12:00:00.000Z'),
      });
      const laterUpdatedEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'TSLA',
          exchange: 'NMS',
          name: 'Tesla, Inc.',
          sector: 'Consumer Cyclical',
          industry: 'Auto Manufacturers',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 420.75 },
        transactionType: 'sell',
        transactionDate: '2025-12-20T08:30:00.000Z',
        createdAt: new Date('2025-12-20T13:00:00.000Z'),
        updatedAt: new Date('2025-12-20T13:00:00.000Z'),
      });

      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body).toEqual([laterUpdatedEntry, earlierUpdatedEntry, oldestEntry]);
    },
  );

  integrationTest(
    'returns an empty array when the user has no portfolio entries yet',
    async ({ app, sessionToken }) => {
      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body).toEqual([]);
    },
  );

  integrationTest('does not return another user portfolio entries', async ({ app, db, sessionToken, userId }) => {
    const currentUserEntry = await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 5,
      purchasePrice: { currency: 'USD', value: 175.25 },
      transactionType: 'buy',
      transactionDate: '2025-12-18T10:30:00.000Z',
    });
    const otherUser = await createTestUserAndSession(db);
    await seedPortfolioEntry(db, {
      userId: otherUser.userId,
      stock: { symbol: 'NVDA', exchange: 'NMS', name: 'NVIDIA Corporation' },
      amount: 9,
      purchasePrice: { currency: 'USD', value: 140.1 },
      transactionType: 'buy',
      transactionDate: '2025-12-21T10:30:00.000Z',
    });

    const response = await sendListEntriesRequest(app, { sessionToken });
    const body = await expectSuccessfulListEntriesResponse(response);

    expect(body).toEqual([currentUserEntry]);
  });

  integrationTest('rejects a request without authentication', async ({ app }) => {
    const response = await sendListEntriesRequest(app, {});

    await expectNotFoundErrorResponse(response);
  });

  integrationTest(
    'logs the database cause chain when listing entries fails unexpectedly',
    async ({ app, db, sessionToken }) => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
        void message;
      });

      try {
        await db.execute(sql.raw('ALTER TABLE "stock_ticker" DROP COLUMN "sector"'));

        const response = await sendListEntriesRequest(app, { sessionToken });
        const body = await expectInternalServerErrorResponse(response);
        const logOutput = consoleErrorSpy.mock.calls.flat().join('\n');

        expect(body).toEqual({
          message: 'Something went wrong',
          code: 'INTERNAL_SERVER_ERROR',
        });
        expect(logOutput).toContain('GET /app-api/portfolio/entries Uncaught exception');
        expect(logOutput).toContain('Failed query');
        expect(logOutput).toContain('Cause 1:');
        expect(logOutput).toContain('stack');
        expect(logOutput).toContain('column stock_ticker.sector does not exist');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    },
  );
});

async function sendListEntriesRequest(
  app: AppRequestClient,
  options: {
    sessionToken?: string;
  },
) {
  return app.request(LIST_ENTRIES_PATH, {
    method: 'GET',
    headers: createListEntriesRequestHeaders(options.sessionToken),
  });
}

function createListEntriesRequestHeaders(sessionToken?: string) {
  const headers = new Headers();

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulListEntriesResponse(response: Response) {
  expect(response.status).toBe(200);

  return ListEntriesResponseSchema.parse(await response.json());
}

async function expectNotFoundErrorResponse(response: Response) {
  expect(response.status).toBe(404);

  return ErrorResponseSchema.parse(await response.json());
}

async function expectInternalServerErrorResponse(response: Response) {
  expect(response.status).toBe(500);

  return ErrorResponseSchema.parse(await response.json());
}
