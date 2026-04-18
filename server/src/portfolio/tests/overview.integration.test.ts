import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { PortfolioOverviewResponseSchema, ResolvedEntryResponseSchema } from '../schemas/responses';
import { seedExchangeRate, seedPortfolioEntry, seedStockInfo } from './helpers';
import { APP_API_BASE_PATH, type ResolvedtransactionType } from '@/constants/common';
import { ErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { yahooFinanceQuoteMock } from '@/tests/mocks/yahoo-finance';
import * as schema from '@/db/schema';
import { createSyntheticTickerId } from '@/utils/tickers';

const OVERVIEW_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/overview`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Portfolio Overview Route', () => {
  integrationTest(
    'resolves split entries before returning overview transactions and current values',
    async ({ app, db, sessionToken, userId }) => {
      const purchaseEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 5,
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });
      const splitEntry = await seedPortfolioEntry(db, {
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
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: new Date().toISOString().slice(0, 10),
        price: 16,
      });

      const response = await sendOverviewRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewResponse(response);

      expect(body).toEqual({
        transactions: [
          makeResolvedSplitEntry({
            id: body.transactions[0]?.id ?? '',
            entry: splitEntry,
            amount: 50,
            purchasePrice: 15,
            transactionType: 'buy',
          }),
          makeResolvedSplitEntry({
            id: body.transactions[1]?.id ?? '',
            entry: splitEntry,
            amount: 5,
            purchasePrice: 150,
            transactionType: 'sell',
          }),
          withPreferredCurrencyPurchasePrice(purchaseEntry),
        ],
        current_values: {
          AAPL: { currency: 'USD', value: 16 },
        },
      });
    },
  );

  integrationTest(
    'returns transactions and current_values from cached daily prices',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const aaplEntry = await seedPortfolioEntry(db, {
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
      });
      const msftEntry = await seedPortfolioEntry(db, {
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
      });
      const today = new Date().toISOString().slice(0, 10);

      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: today,
        price: 185.45,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'MSFT'),
        currency: 'USD',
        date: today,
        price: 420.5,
      });

      const request = withRequestId(createOverviewRequestHeaders(sessionToken));
      const response = await sendOverviewRequest(app, {}, request.headers);
      const body = await expectSuccessfulOverviewResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        transactions: [withPreferredCurrencyPurchasePrice(aaplEntry), withPreferredCurrencyPurchasePrice(msftEntry)],
        current_values: {
          AAPL: { currency: 'USD', value: 185.45 },
          MSFT: { currency: 'USD', value: 420.5 },
        },
      });
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.stock_prices.resolved',
            request_id: request.requestId,
            component: 'portfolio',
            result_count: 2,
            stored_count: 0,
          }),
          expect.objectContaining({
            event: 'portfolio.overview.retrieved',
            request_id: request.requestId,
            component: 'portfolio',
            result_count: 2,
            stored_count: 2,
          }),
        ]),
      );
    },
  );

  integrationTest(
    'returns an empty overview when the user has no portfolio entries yet',
    async ({ app, sessionToken }) => {
      const response = await sendOverviewRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewResponse(response);

      expect(body).toEqual({
        transactions: [],
        current_values: {},
      });
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
    },
  );

  integrationTest(
    'fetches missing stock prices from Yahoo and stores them for today',
    async ({ app, db, sessionToken, userId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 150.5 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });
      const today = new Date().toISOString().slice(0, 10);

      const response = await sendOverviewRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewResponse(response);
      const storedPrice = await db
        .select({
          tickerId: schema.stockInfo.tickerId,
          currency: schema.stockInfo.currency,
          date: schema.stockInfo.date,
          close: schema.stockInfo.close,
        })
        .from(schema.stockInfo)
        .where(eq(schema.stockInfo.id, `${createSyntheticTickerId('NMS', 'AAPL')}:${today}`));

      expect(body.current_values).toEqual({
        AAPL: { currency: 'USD', value: 150 },
      });
      expect(yahooFinanceQuoteMock).toHaveBeenCalledWith(['AAPL'], {
        fields: ['symbol', 'regularMarketPrice', 'currency'],
      });
      expect(storedPrice).toHaveLength(1);
      expect(storedPrice[0]).toMatchObject({
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        close: '150.0000000000',
      });
      expect(storedPrice[0]?.date.startsWith(today)).toBe(true);
    },
  );

  integrationTest(
    'converts current values to the user preferred currency when an FX snapshot exists',
    async ({ app, db, sessionToken, userId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedExchangeRate(db, {
        base: 'EUR',
        date: '2026-03-29',
        rates: { USD: 1.1 },
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
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: new Date().toISOString().slice(0, 10),
        price: 110,
      });

      const response = await sendOverviewRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewResponse(response);

      expect(body.current_values.AAPL?.currency).toBe('EUR');
      expect(body.current_values.AAPL?.value).toBeCloseTo(100);
    },
  );

  integrationTest(
    'returns an internal server error when preferred-currency current values need FX data that is missing',
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
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: new Date().toISOString().slice(0, 10),
        price: 110,
      });

      const request = withRequestId(createOverviewRequestHeaders(sessionToken));
      const response = await sendOverviewRequest(app, {}, request.headers);
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
            route: OVERVIEW_PATH,
            status_code: 500,
            error_code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'returns an internal server error when the FX snapshot is missing a required currency conversion',
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
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: new Date().toISOString().slice(0, 10),
        price: 110,
      });

      const request = withRequestId(createOverviewRequestHeaders(sessionToken));
      const response = await sendOverviewRequest(app, {}, request.headers);
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
            route: OVERVIEW_PATH,
            status_code: 500,
            error_code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'falls back to the latest stored price when Yahoo does not resolve a missing daily quote',
    async ({ app, db, sessionToken, userId }) => {
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
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: '2026-04-01',
        price: 180.25,
      });
      yahooFinanceQuoteMock.mockResolvedValue([]);

      const response = await sendOverviewRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewResponse(response);

      expect(body.current_values).toEqual({
        AAPL: { currency: 'USD', value: 180.25 },
      });
    },
  );

  integrationTest('rejects a request without authentication', async ({ app }) => {
    const response = await sendOverviewRequest(app, {});

    await expectNotFoundErrorResponse(response);
  });

  integrationTest(
    'returns an internal server error when no current stock price can be resolved',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'BMW.DE',
          exchange: 'XETR',
          name: 'Bayerische Motoren Werke Aktiengesellschaft',
        },
        amount: 1,
        purchasePrice: { currency: 'EUR', value: 100 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });
      yahooFinanceQuoteMock.mockResolvedValue([]);

      const request = withRequestId(createOverviewRequestHeaders(sessionToken));
      const response = await sendOverviewRequest(app, {}, request.headers);
      const body = await expectInternalServerErrorResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'Failed to resolve current stock prices',
        code: 'STOCK_PRICE_FETCH_FAILED',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.error',
            request_id: request.requestId,
            route: OVERVIEW_PATH,
            status_code: 500,
            error_code: 'STOCK_PRICE_FETCH_FAILED',
          }),
        ]),
      );
    },
  );
});

async function sendOverviewRequest(
  app: AppRequestClient,
  options: {
    sessionToken?: string;
  },
  headers?: Headers,
) {
  return app.request(OVERVIEW_PATH, {
    method: 'GET',
    headers: headers ?? createOverviewRequestHeaders(options.sessionToken),
  });
}

function createOverviewRequestHeaders(sessionToken?: string) {
  const headers = new Headers();

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulOverviewResponse(response: Response) {
  expect(response.status).toBe(200);

  return PortfolioOverviewResponseSchema.parse(await response.json());
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
