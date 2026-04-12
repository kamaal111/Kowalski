import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { APP_API_BASE_PATH } from '@/constants/common';
import type { Database } from '@/db';
import { portfolio, portfolioTransaction, stockTicker, user } from '@/db/schema';
import { ErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { createTestUserAndSession } from '@/tests/utils';
import { BulkCreateEntriesPayloadSchema } from '../schemas/payloads';
import { BulkCreateEntriesResponseSchema } from '../schemas/responses';
import { seedPortfolioEntry } from './helpers';

const BULK_CREATE_ENTRIES_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entries/bulk`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Bulk Create Portfolio Entries Route', () => {
  integrationTest(
    'creates all new entries when the provided ids are unused',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const payload = BulkCreateEntriesPayloadSchema.parse({
        entries: [
          makeBulkCreateEntryPayload({ id: '550e8400-e29b-41d4-a716-446655440000', symbol: 'AAPL' }),
          makeBulkCreateEntryPayload({
            id: '550e8400-e29b-41d4-a716-446655440001',
            symbol: 'TSLA',
            name: 'Tesla, Inc.',
          }),
          makeBulkCreateEntryPayload({
            id: '550e8400-e29b-41d4-a716-446655440002',
            symbol: 'NVDA',
            name: 'NVIDIA Corporation',
            amount: 4,
          }),
        ],
      });
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(app, payload, request.headers);
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectSuccessfulBulkCreateEntriesResponse(response);
      const persistedTransactions = await getPersistedTransactionsForCurrentUser(db);

      expect(body).toHaveLength(3);
      expect(body.map(entry => entry.id)).toEqual([
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ]);
      expect(persistedTransactions).toHaveLength(3);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.bulk_created',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            user_id: userId,
            created_count: 3,
            skipped_count: 0,
            total_count: 3,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'creates entries without client-supplied ids',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const payload = BulkCreateEntriesPayloadSchema.parse({
        entries: [
          makeBulkCreateEntryPayloadWithoutId({ symbol: 'AAPL' }),
          makeBulkCreateEntryPayloadWithoutId({
            symbol: 'TSLA',
            name: 'Tesla, Inc.',
          }),
        ],
      });
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(app, payload, request.headers);
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectSuccessfulBulkCreateEntriesResponse(response);
      const persistedTransactions = await getPersistedTransactionsForCurrentUser(db);

      expect(body).toHaveLength(2);
      expect(new Set(body.map(entry => entry.id)).size).toBe(2);
      expect(persistedTransactions).toHaveLength(2);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.bulk_created',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            user_id: userId,
            created_count: 2,
            skipped_count: 0,
            total_count: 2,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'silently skips entries whose ids already exist',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const firstEntry = await seedPortfolioEntry(db, {
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
        transactionDate: '2025-12-20T00:00:00.000Z',
      });
      const secondEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'TSLA',
          exchange: 'NMS',
          name: 'Tesla, Inc.',
          isin: 'US88160R1014',
          sector: 'Consumer Cyclical',
          industry: 'Auto Manufacturers',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 220.0 },
        transactionType: 'buy',
        transactionDate: '2025-12-21T00:00:00.000Z',
      });
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(
        app,
        BulkCreateEntriesPayloadSchema.parse({
          entries: [
            makeBulkCreateEntryPayload({ id: firstEntry.id, symbol: 'AAPL' }),
            makeBulkCreateEntryPayload({ id: secondEntry.id, symbol: 'TSLA', name: 'Tesla, Inc.' }),
          ],
        }),
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectSuccessfulBulkCreateEntriesResponse(response);
      const persistedTransactions = await getPersistedTransactionsForCurrentUser(db);

      expect(body).toEqual([]);
      expect(persistedTransactions).toHaveLength(2);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.bulk_created',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            user_id: userId,
            created_count: 0,
            skipped_count: 2,
            total_count: 2,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'creates new entries and skips duplicate ids in the same batch',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const existingEntry = await seedPortfolioEntry(db, {
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
        transactionDate: '2025-12-20T00:00:00.000Z',
      });
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(
        app,
        BulkCreateEntriesPayloadSchema.parse({
          entries: [
            makeBulkCreateEntryPayload({ id: existingEntry.id, symbol: 'AAPL' }),
            makeBulkCreateEntryPayload({
              id: '550e8400-e29b-41d4-a716-446655440010',
              symbol: 'TSLA',
              name: 'Tesla, Inc.',
            }),
            makeBulkCreateEntryPayload({
              id: '550e8400-e29b-41d4-a716-446655440011',
              symbol: 'NVDA',
              name: 'NVIDIA Corporation',
              amount: 4,
            }),
          ],
        }),
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectSuccessfulBulkCreateEntriesResponse(response);
      const persistedTransactions = await getPersistedTransactionsForCurrentUser(db);

      expect(body).toHaveLength(2);
      expect(body.map(entry => entry.id)).toEqual([
        '550e8400-e29b-41d4-a716-446655440010',
        '550e8400-e29b-41d4-a716-446655440011',
      ]);
      expect(persistedTransactions).toHaveLength(3);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.bulk_created',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            user_id: userId,
            created_count: 2,
            skipped_count: 1,
            total_count: 3,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'does not silently skip ids that belong to another user portfolio',
    async ({ app, db, sessionToken, getLogsForRequestId, withRequestId }) => {
      const otherUser = await createTestUserAndSession(db);
      const otherUsersEntry = await seedPortfolioEntry(db, {
        userId: otherUser.userId,
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
        transactionDate: '2025-12-20T00:00:00.000Z',
      });
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(
        app,
        BulkCreateEntriesPayloadSchema.parse({
          entries: [makeBulkCreateEntryPayload({ id: otherUsersEntry.id, symbol: 'AAPL' })],
        }),
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectInternalServerErrorResponse(response);
      const persistedTransactions = await getPersistedTransactionsForCurrentUser(db);

      expect(body).toEqual({
        message: 'Something went wrong',
        code: 'INTERNAL_SERVER_ERROR',
      });
      expect(persistedTransactions).toHaveLength(0);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.failed',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            status_code: 500,
            error_code: 'INTERNAL_SERVER_ERROR',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'reuses the prefetched stock ticker when the same symbol appears multiple times in one batch',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const firstEntry = makeBulkCreateEntryPayload({
        id: '550e8400-e29b-41d4-a716-446655440020',
        symbol: 'AAPL',
      });
      const secondEntry = makeBulkCreateEntryPayload({
        id: '550e8400-e29b-41d4-a716-446655440021',
        symbol: 'AAPL',
        name: 'Apple Incorporated',
      });
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(
        app,
        BulkCreateEntriesPayloadSchema.parse({
          entries: [
            firstEntry,
            {
              ...secondEntry,
              stock: {
                ...secondEntry.stock,
                sector: 'Information Technology',
                industry: 'Hardware',
                exchange_dispatch: 'NASDAQ Global Select',
              },
            },
          ],
        }),
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectSuccessfulBulkCreateEntriesResponse(response);
      const persistedTransactions = await getPersistedTransactionsForCurrentUser(db);
      const persistedTickers = await getPersistedTickersBySymbol(db, 'AAPL');

      expect(body).toHaveLength(2);
      expect(persistedTransactions).toHaveLength(2);
      expect(persistedTickers).toHaveLength(1);
      expect(persistedTickers[0]).toMatchObject({
        isin: 'US0378331005',
        name: 'Apple Incorporated',
        sector: 'Information Technology',
        industry: 'Hardware',
        exchangeDispatch: 'NASDAQ Global Select',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.bulk_created',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            user_id: userId,
            created_count: 2,
            skipped_count: 0,
            total_count: 2,
            outcome: 'success',
          }),
        ]),
      );
      expect(logs.some(log => log.event === 'portfolio.ticker.updated')).toBe(false);
    },
  );

  integrationTest(
    'accepts an empty entries array',
    async ({ app, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const request = withRequestId(createBulkCreateEntriesRequestHeaders(sessionToken));
      const response = await sendBulkCreateEntriesRequest(
        app,
        BulkCreateEntriesPayloadSchema.parse({ entries: [] }),
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);
      const body = await expectSuccessfulBulkCreateEntriesResponse(response);

      expect(body).toEqual([]);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entries.bulk_created',
            request_id: request.requestId,
            route: BULK_CREATE_ENTRIES_PATH,
            user_id: userId,
            created_count: 0,
            skipped_count: 0,
            total_count: 0,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest('rejects a request without authentication', async ({ app }) => {
    const response = await sendBulkCreateEntriesRequest(
      app,
      BulkCreateEntriesPayloadSchema.parse({ entries: [makeBulkCreateEntryPayload()] }),
    );

    await expectNotFoundErrorResponse(response);
  });
});

function makeBulkCreateEntryPayload({
  id = '550e8400-e29b-41d4-a716-446655440099',
  symbol = 'AAPL',
  name = 'Apple Inc.',
  amount = 10,
}: {
  id?: string;
  symbol?: string;
  name?: string;
  amount?: number;
} = {}) {
  return {
    id,
    stock: {
      symbol,
      exchange: 'NMS',
      name,
      isin: symbol === 'AAPL' ? 'US0378331005' : symbol === 'TSLA' ? 'US88160R1014' : 'US67066G1040',
      sector: symbol === 'TSLA' ? 'Consumer Cyclical' : 'Technology',
      industry:
        symbol === 'TSLA' ? 'Auto Manufacturers' : symbol === 'NVDA' ? 'Semiconductors' : 'Consumer Electronics',
      exchange_dispatch: 'NASDAQ',
    },
    amount,
    purchase_price: {
      currency: 'USD',
      value: 150.5,
    },
    transaction_type: 'buy',
    transaction_date: '2025-12-20T10:30:00.000Z',
  };
}

function makeBulkCreateEntryPayloadWithoutId(input: Parameters<typeof makeBulkCreateEntryPayload>[0] = {}) {
  const entry = makeBulkCreateEntryPayload(input);

  return {
    stock: entry.stock,
    amount: entry.amount,
    purchase_price: entry.purchase_price,
    transaction_type: entry.transaction_type,
    transaction_date: entry.transaction_date,
  };
}

async function sendBulkCreateEntriesRequest(app: AppRequestClient, payload: unknown, headers?: Headers) {
  return app.request(BULK_CREATE_ENTRIES_PATH, {
    method: 'POST',
    headers: headers ?? createBulkCreateEntriesRequestHeaders(),
    body: JSON.stringify(payload),
  });
}

function createBulkCreateEntriesRequestHeaders(sessionToken?: string) {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulBulkCreateEntriesResponse(response: Response) {
  expect(response.status).toBe(201);

  return BulkCreateEntriesResponseSchema.parse(await response.json());
}

async function expectNotFoundErrorResponse(response: Response) {
  expect(response.status).toBe(404);

  return ErrorResponseSchema.parse(await response.json());
}

async function expectInternalServerErrorResponse(response: Response) {
  expect(response.status).toBe(500);

  return ErrorResponseSchema.parse(await response.json());
}

async function getPersistedTransactionsForCurrentUser(db: Database) {
  const currentUser = await db.select({ id: user.id }).from(user).limit(1);
  const userId = currentUser.at(0)?.id;
  if (userId == null) {
    throw new Error('Expected a persisted user');
  }

  const portfolios = await db.select({ id: portfolio.id }).from(portfolio).where(eq(portfolio.userId, userId)).limit(1);
  const portfolioId = portfolios.at(0)?.id;
  if (portfolioId == null) {
    throw new Error('Expected a persisted portfolio');
  }

  return db.select().from(portfolioTransaction).where(eq(portfolioTransaction.portfolioId, portfolioId));
}

async function getPersistedTickersBySymbol(db: Database, symbol: string) {
  return db.select().from(stockTicker).where(eq(stockTicker.symbol, symbol));
}
