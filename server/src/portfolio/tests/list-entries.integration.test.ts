import { sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';

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
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
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

      const request = withRequestId(createListEntriesRequestHeaders(sessionToken));
      const response = await sendListEntriesRequest(app, {}, request.headers);
      const body = await expectSuccessfulListEntriesResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual([laterUpdatedEntry, earlierUpdatedEntry, oldestEntry]);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.listed',
            request_id: request.requestId,
            component: 'portfolio',
            result_count: 3,
          }),
        ]),
      );
    },
  );

  integrationTest('returns stored isins for portfolio entries', async ({ app, db, sessionToken, userId }) => {
    await seedPortfolioEntry(db, {
      userId,
      stock: {
        symbol: 'AAPL',
        exchange: 'NMS',
        name: 'Apple Inc.',
        isin: 'US0378331005',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        exchangeDispatch: 'NASDAQ',
      },
      amount: 10,
      purchasePrice: { currency: 'USD', value: 150.5 },
      transactionType: 'buy',
      transactionDate: '2025-12-20T10:30:00.000Z',
    });

    const response = await sendListEntriesRequest(app, { sessionToken });
    const body = await expectSuccessfulListEntriesResponse(response);

    expect(body[0]?.stock.isin).toBe('US0378331005');
  });

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
    'logs structured request failures when listing entries fails unexpectedly',
    async ({ app, db, sessionToken, getLogsForRequestId, withRequestId }) => {
      await db.execute(sql.raw('ALTER TABLE "stock_ticker" DROP COLUMN "sector"'));

      const request = withRequestId(createListEntriesRequestHeaders(sessionToken));
      const response = await sendListEntriesRequest(app, {}, request.headers);
      const body = await expectInternalServerErrorResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'Something went wrong',
        code: 'INTERNAL_SERVER_ERROR',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.failed',
            request_id: request.requestId,
            route: LIST_ENTRIES_PATH,
            status_code: 500,
            error_code: 'INTERNAL_SERVER_ERROR',
            error_name: 'DrizzleQueryError',
          }),
        ]),
      );
      expect(JSON.stringify(logs)).toContain('column stock_ticker.sector does not exist');
    },
  );
});

async function sendListEntriesRequest(
  app: AppRequestClient,
  options: {
    sessionToken?: string;
  },
  headers?: Headers,
) {
  return app.request(LIST_ENTRIES_PATH, {
    method: 'GET',
    headers: headers ?? createListEntriesRequestHeaders(options.sessionToken),
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
