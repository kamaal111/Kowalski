import { sql } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { ListEntriesResponseSchema, ResolvedEntryResponseSchema } from '../schemas/responses';
import { seedExchangeRate, seedPortfolioEntry } from './helpers';
import { APP_API_BASE_PATH, type ResolvedtransactionType } from '@/constants/common';
import { ErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { createTestUserAndSession } from '@/tests/utils';
import * as schema from '@/db/schema';

const LIST_ENTRIES_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entries`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('List Portfolio Entries Route', () => {
  integrationTest(
    'resolves split entries into synthetic sell and buy pairs with stable ids',
    async ({ app, db, sessionToken, userId }) => {
      const purchaseEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 5,
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
        createdAt: new Date('2025-12-19T12:00:00.000Z'),
        updatedAt: new Date('2025-12-19T12:00:00.000Z'),
      });
      const splitEntry = await seedPortfolioEntry(db, {
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
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'split',
        transactionDate: '2025-12-20T10:30:00.000Z',
        createdAt: new Date('2025-12-20T12:00:00.000Z'),
        updatedAt: new Date('2025-12-20T12:00:00.000Z'),
      });

      const firstResponse = await sendListEntriesRequest(app, { sessionToken });
      const firstBody = await expectSuccessfulListEntriesResponse(firstResponse);
      const secondResponse = await sendListEntriesRequest(app, { sessionToken });
      const secondBody = await expectSuccessfulListEntriesResponse(secondResponse);
      const buyEntry = firstBody[0];
      const sellEntry = firstBody[1];

      expect(firstBody).toHaveLength(3);
      expect(firstBody).toEqual(secondBody);
      expect(sellEntry?.id).toMatch(UUID_PATTERN);
      expect(buyEntry?.id).toMatch(UUID_PATTERN);
      expect(sellEntry?.id).not.toBe(splitEntry.id);
      expect(buyEntry?.id).not.toBe(splitEntry.id);
      expect(firstBody).toEqual([
        makeResolvedSplitEntry({
          id: buyEntry?.id ?? '',
          entry: splitEntry,
          amount: 50,
          purchasePrice: 15,
          transactionType: 'buy',
        }),
        makeResolvedSplitEntry({
          id: sellEntry?.id ?? '',
          entry: splitEntry,
          amount: 5,
          purchasePrice: 150,
          transactionType: 'sell',
        }),
        withPreferredCurrencyPurchasePrice(purchaseEntry),
      ]);
    },
  );

  integrationTest(
    'omits split entries when there are no shares held for the stock',
    async ({ app, db, sessionToken, userId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'split',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body).toEqual([]);
    },
  );

  integrationTest(
    'resolves multiple splits using the post-split holdings from earlier split entries',
    async ({ app, db, sessionToken, userId }) => {
      const purchaseEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2025-12-18T10:30:00.000Z',
      });
      const firstSplitEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 3,
        purchasePrice: { currency: 'USD', value: 90 },
        transactionType: 'split',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });
      const secondSplitEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 60 },
        transactionType: 'split',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body).toEqual([
        makeResolvedSplitEntry({
          id: body[0]?.id ?? '',
          entry: secondSplitEntry,
          amount: 12,
          purchasePrice: 30,
          transactionType: 'buy',
        }),
        makeResolvedSplitEntry({
          id: body[1]?.id ?? '',
          entry: secondSplitEntry,
          amount: 6,
          purchasePrice: 60,
          transactionType: 'sell',
        }),
        makeResolvedSplitEntry({
          id: body[2]?.id ?? '',
          entry: firstSplitEntry,
          amount: 6,
          purchasePrice: 30,
          transactionType: 'buy',
        }),
        makeResolvedSplitEntry({
          id: body[3]?.id ?? '',
          entry: firstSplitEntry,
          amount: 2,
          purchasePrice: 90,
          transactionType: 'sell',
        }),
        withPreferredCurrencyPurchasePrice(purchaseEntry),
      ]);
    },
  );

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

      expect(body).toEqual([
        withPreferredCurrencyPurchasePrice(laterUpdatedEntry),
        withPreferredCurrencyPurchasePrice(earlierUpdatedEntry),
        withPreferredCurrencyPurchasePrice(oldestEntry),
      ]);
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
    expect(body[0]?.preferred_currency_purchase_price).toBeNull();
  });

  integrationTest(
    'returns preferred_currency_purchase_price as null when the user has no preferred currency',
    async ({ app, db, sessionToken, userId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150.5 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body[0]?.preferred_currency_purchase_price).toBeNull();
    },
  );

  integrationTest(
    'returns the stored purchase price when the entry already uses the preferred currency',
    async ({ app, db, sessionToken, userId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'SAP',
          exchange: 'XETR',
          name: 'SAP SE',
        },
        amount: 3,
        purchasePrice: { currency: 'EUR', value: 200.25 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body[0]?.preferred_currency_purchase_price).toEqual({
        currency: 'EUR',
        value: 200.25,
      });
    },
  );

  integrationTest(
    'converts preferred_currency_purchase_price from the latest stored FX snapshot',
    async ({ app, db, sessionToken, userId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedExchangeRate(db, {
        base: 'EUR',
        date: '2026-03-29',
        rates: { USD: 1.1, GBP: 0.8 },
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 110 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'BP',
          exchange: 'LSE',
          name: 'BP p.l.c.',
        },
        amount: 1,
        purchasePrice: { currency: 'GBP', value: 80 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });

      const response = await sendListEntriesRequest(app, { sessionToken });
      const body = await expectSuccessfulListEntriesResponse(response);

      expect(body[0]?.preferred_currency_purchase_price?.currency).toBe('EUR');
      expect(body[1]?.preferred_currency_purchase_price?.currency).toBe('EUR');
      expect(body[0]?.preferred_currency_purchase_price?.value).toBeCloseTo(100);
      expect(body[1]?.preferred_currency_purchase_price?.value).toBe(100);
    },
  );

  integrationTest(
    'returns an internal server error when preferred-currency purchase prices need FX data that is missing',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 110 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const request = withRequestId(createListEntriesRequestHeaders(sessionToken));
      const response = await sendListEntriesRequest(app, {}, request.headers);
      const body = await expectInternalServerErrorResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'Failed to resolve foreign exchange rates',
        code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.error',
            request_id: request.requestId,
            route: LIST_ENTRIES_PATH,
            status_code: 500,
            error_code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'returns an internal server error when the FX snapshot is missing a required purchase-price conversion',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedExchangeRate(db, {
        base: 'EUR',
        date: '2026-03-29',
        rates: { GBP: 0.8 },
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 110 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const request = withRequestId(createListEntriesRequestHeaders(sessionToken));
      const response = await sendListEntriesRequest(app, {}, request.headers);
      const body = await expectInternalServerErrorResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'Failed to resolve foreign exchange rates',
        code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.error',
            request_id: request.requestId,
            route: LIST_ENTRIES_PATH,
            status_code: 500,
            error_code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
          }),
        ]),
      );
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

    expect(body).toEqual([withPreferredCurrencyPurchasePrice(currentUserEntry)]);
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

function withPreferredCurrencyPurchasePrice(
  entry: { preferred_currency_purchase_price: unknown },
  preferredCurrencyPurchasePrice: unknown = null,
) {
  return {
    ...entry,
    preferred_currency_purchase_price: preferredCurrencyPurchasePrice,
  };
}

function makeResolvedSplitEntry({
  id,
  entry,
  amount,
  purchasePrice,
  transactionType,
}: {
  id: string;
  entry: Awaited<ReturnType<typeof seedPortfolioEntry>>;
  amount: number;
  purchasePrice: number;
  transactionType: ResolvedtransactionType;
}) {
  return ResolvedEntryResponseSchema.parse({
    ...entry,
    id,
    amount,
    purchase_price: {
      currency: entry.purchase_price.currency,
      value: purchasePrice,
    },
    preferred_currency_purchase_price: null,
    transaction_type: transactionType,
  });
}

async function expectNotFoundErrorResponse(response: Response) {
  expect(response.status).toBe(404);

  return ErrorResponseSchema.parse(await response.json());
}

async function expectInternalServerErrorResponse(response: Response) {
  expect(response.status).toBe(500);

  return ErrorResponseSchema.parse(await response.json());
}
