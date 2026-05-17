import crypto from 'node:crypto';

import { describe, expect, vi } from 'vitest';

import { ASSET_TYPES } from '@/constants/common';
import { PORTFOLIO_ROUTE_NAME } from '..';
import { PortfolioHoldingsPreflightResponseSchema, PortfolioHoldingsResponseSchema } from '../schemas/responses';
import { seedExchangeRate, seedPortfolioEntry, seedStockInfo } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import { ErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { yahooFinanceQuoteMock } from '@/tests/mocks/yahoo-finance';
import { createTestUserAndSession } from '@/tests/utils';
import { createSyntheticTickerId } from '@/utils/tickers';
import * as schema from '@/db/schema';

const HOLDINGS_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/holdings`;
const HOLDINGS_PREFLIGHT_PATH = `${HOLDINGS_PATH}/preflight`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Portfolio Holdings Route', () => {
  integrationTest('returns ready preflight when portfolio is empty', async ({ app, sessionToken }) => {
    const response = await sendHoldingsPreflightRequest(app, { sessionToken });
    const body = await expectSuccessfulHoldingsPreflightResponse(response);

    expect(body).toEqual({
      refresh_state: 'ready',
      poll_after_ms: null,
      latest_cached_price_date: null,
    });
    expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
  });

  integrationTest(
    'returns ready preflight when all active tickers have today prices',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: today,
        price: 185,
      });

      const response = await sendHoldingsPreflightRequest(app, { sessionToken });
      const body = await expectSuccessfulHoldingsPreflightResponse(response);

      expect(body).toEqual({
        refresh_state: 'ready',
        poll_after_ms: null,
        latest_cached_price_date: today,
      });
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
    },
  );

  integrationTest(
    'returns refreshing preflight with configured polling when a current price is missing',
    async ({ app, db, sessionToken, userId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: '2026-05-16',
        price: 180,
      });

      const response = await sendHoldingsPreflightRequest(app, { sessionToken });
      const body = await expectSuccessfulHoldingsPreflightResponse(response);

      expect(body).toEqual({
        refresh_state: 'refreshing',
        poll_after_ms: 1500,
        latest_cached_price_date: '2026-05-16',
      });
      await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledOnce());
    },
  );

  integrationTest(
    'starts only one refresh for concurrent preflight requests for the same user and day',
    async ({ app, db, sessionToken, userId }) => {
      let resolveQuotes: (value: { symbol: string; regularMarketPrice: number; currency: string }[]) => void = () => {
        throw new Error('Yahoo quote promise was not initialized');
      };
      yahooFinanceQuoteMock.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveQuotes = resolve;
          }),
      );
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });

      const responses = await Promise.all([
        sendHoldingsPreflightRequest(app, { sessionToken }),
        sendHoldingsPreflightRequest(app, { sessionToken }),
      ]);
      const bodies = await Promise.all(responses.map(expectSuccessfulHoldingsPreflightResponse));

      expect(bodies.map(body => body.refresh_state)).toEqual(['refreshing', 'refreshing']);
      expect(yahooFinanceQuoteMock).toHaveBeenCalledOnce();
      resolveQuotes([{ symbol: 'AAPL', regularMarketPrice: 190, currency: 'USD' }]);
    },
  );

  integrationTest(
    'returns ready after same-day refresh completes without new quotes',
    async ({ app, db, sessionToken, userId }) => {
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

      const firstResponse = await sendHoldingsPreflightRequest(app, { sessionToken });
      const firstBody = await expectSuccessfulHoldingsPreflightResponse(firstResponse);
      await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledOnce());
      const secondResponse = await sendHoldingsPreflightRequest(app, { sessionToken });
      const secondBody = await expectSuccessfulHoldingsPreflightResponse(secondResponse);

      expect(firstBody.refresh_state).toBe('refreshing');
      expect(secondBody).toEqual({
        refresh_state: 'ready',
        poll_after_ms: null,
        latest_cached_price_date: null,
      });
    },
  );

  integrationTest('does not leak preflight coordination across users', async ({ app, db, sessionToken, userId }) => {
    const otherUser = await createTestUserAndSession(db);
    yahooFinanceQuoteMock.mockResolvedValue([]);
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 100 },
      transactionType: 'buy',
      transactionDate: '2025-12-20T10:30:00.000Z',
    });
    await seedPortfolioEntry(db, {
      userId: otherUser.userId,
      stock: { symbol: 'MSFT', exchange: 'NMS', name: 'Microsoft Corporation' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 200 },
      transactionType: 'buy',
      transactionDate: '2025-12-20T10:30:00.000Z',
    });

    await expectSuccessfulHoldingsPreflightResponse(await sendHoldingsPreflightRequest(app, { sessionToken }));
    await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledOnce());
    const otherUserResponse = await sendHoldingsPreflightRequest(app, { sessionToken: otherUser.token });
    const otherUserBody = await expectSuccessfulHoldingsPreflightResponse(otherUserResponse);

    expect(otherUserBody.refresh_state).toBe('refreshing');
    await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledTimes(2));
  });

  integrationTest(
    'aggregates multiple transactions for the same symbol into one holding',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      await seedPortfolioEntry(db, {
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
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 3,
        purchasePrice: { currency: 'USD', value: 170 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: new Date().toISOString().slice(0, 10),
        price: 185,
      });

      const request = withRequestId(createHoldingsRequestHeaders(sessionToken));
      const response = await sendHoldingsRequest(app, {}, request.headers);
      const body = await expectSuccessfulHoldingsResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        net_worth: { currency: 'USD', value: 2405 },
        holdings: [
          {
            asset_type: ASSET_TYPES.EQUITY,
            asset: {
              symbol: 'AAPL',
              exchange: 'NMS',
              name: 'Apple Inc.',
              isin: 'PORTFOLIO-NMS-AAPL',
              sector: 'Technology',
              industry: 'Consumer Electronics',
              exchange_dispatch: 'NASDAQ',
            },
            amount: 13,
            unit_value: { currency: 'USD', value: 185 },
            total_value: { currency: 'USD', value: 2405 },
          },
        ],
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.holdings.retrieved',
            request_id: request.requestId,
            component: 'portfolio',
            result_count: 1,
            net_worth_currency: 'USD',
          }),
        ]),
      );
    },
  );

  integrationTest('reduces held amount and total value for sells', async ({ app, db, sessionToken, userId }) => {
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 10,
      purchasePrice: { currency: 'USD', value: 150 },
      transactionType: 'buy',
      transactionDate: '2025-12-19T10:30:00.000Z',
    });
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 4,
      purchasePrice: { currency: 'USD', value: 175 },
      transactionType: 'sell',
      transactionDate: '2025-12-20T10:30:00.000Z',
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: new Date().toISOString().slice(0, 10),
      price: 200,
    });

    const response = await sendHoldingsRequest(app, { sessionToken });
    const body = await expectSuccessfulHoldingsResponse(response);

    expect(body.net_worth).toEqual({ currency: 'USD', value: 1200 });
    expect(body.holdings[0]?.amount).toBe(6);
    expect(body.holdings[0]?.total_value).toEqual({ currency: 'USD', value: 1200 });
  });

  integrationTest('resolves split entries before aggregating holdings', async ({ app, db, sessionToken, userId }) => {
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 5,
      purchasePrice: { currency: 'USD', value: 150 },
      transactionType: 'buy',
      transactionDate: '2025-12-19T10:30:00.000Z',
    });
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
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

    const response = await sendHoldingsRequest(app, { sessionToken });
    const body = await expectSuccessfulHoldingsResponse(response);

    expect(body.net_worth).toEqual({ currency: 'USD', value: 800 });
    expect(body.holdings[0]?.amount).toBe(50);
    expect(body.holdings[0]?.unit_value).toEqual({ currency: 'USD', value: 16 });
  });

  integrationTest('returns zero net worth and empty holdings for an empty portfolio', async ({ app, sessionToken }) => {
    const response = await sendHoldingsRequest(app, { sessionToken });
    const body = await expectSuccessfulHoldingsResponse(response);

    expect(body).toEqual({
      net_worth: { currency: 'USD', value: 0 },
      holdings: [],
    });
    expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
  });

  integrationTest(
    'converts unit value, total value, and net worth to preferred currency',
    async ({ app, db, sessionToken, userId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedExchangeRate(db, {
        base: 'EUR',
        date: '2026-03-29',
        rates: { USD: 1.1 },
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 2,
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

      const response = await sendHoldingsRequest(app, { sessionToken });
      const body = await expectSuccessfulHoldingsResponse(response);

      expect(body.holdings[0]?.unit_value.currency).toBe('EUR');
      expect(body.holdings[0]?.unit_value.value).toBeCloseTo(100);
      expect(body.holdings[0]?.total_value.currency).toBe('EUR');
      expect(body.holdings[0]?.total_value.value).toBeCloseTo(200);
      expect(body.net_worth.currency).toBe('EUR');
      expect(body.net_worth.value).toBeCloseTo(200);
    },
  );

  integrationTest(
    'returns an internal server error when required FX data is missing',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      await db.insert(schema.userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
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

      const request = withRequestId(createHoldingsRequestHeaders(sessionToken));
      const response = await sendHoldingsRequest(app, {}, request.headers);
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
            route: HOLDINGS_PATH,
            status_code: 500,
            error_code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'returns an internal server error when no current stock price can be resolved',
    async ({ app, db, sessionToken, userId }) => {
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

      const response = await sendHoldingsRequest(app, { sessionToken });
      const body = await expectInternalServerErrorResponse(response);

      expect(body).toEqual({
        message: 'Failed to resolve current stock prices',
        code: 'STOCK_PRICE_FETCH_FAILED',
      });
    },
  );

  integrationTest(
    'returns an internal server error when a persisted ticker id is malformed',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const malformedTickerId = 'portfolio-stock::AAPL';
      const portfolioId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      const today = new Date().toISOString().slice(0, 10);
      await db.insert(schema.portfolio).values({
        id: portfolioId,
        name: 'Default Portfolio',
        userId,
      });
      await db.insert(schema.stockTicker).values({
        id: malformedTickerId,
        isin: 'PORTFOLIO--AAPL',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        exchangeDispatch: 'NASDAQ',
      });
      await db.insert(schema.portfolioTransaction).values({
        id: transactionId,
        transactionType: 'buy',
        transactionDate: '2025-12-20',
        amount: '1',
        purchasePrice: '150',
        purchasePriceCurrency: 'USD',
        tickerId: malformedTickerId,
        portfolioId,
      });
      await db.insert(schema.stockInfo).values({
        id: `${malformedTickerId}:${today}`,
        tickerId: malformedTickerId,
        currency: 'USD',
        date: today,
        close: '185',
      });

      const request = withRequestId(createHoldingsRequestHeaders(sessionToken));
      const response = await sendHoldingsRequest(app, {}, request.headers);
      const body = await expectInternalServerErrorResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'Encountered invalid persisted ticker data',
        code: 'INVALID_TICKER_ID',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.error',
            request_id: request.requestId,
            route: HOLDINGS_PATH,
            status_code: 500,
            error_code: 'INVALID_TICKER_ID',
          }),
        ]),
      );
    },
  );

  integrationTest('does not return another user holdings', async ({ app, db, sessionToken, userId }) => {
    await seedPortfolioEntry(db, {
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
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: new Date().toISOString().slice(0, 10),
      price: 200,
    });

    const response = await sendHoldingsRequest(app, { sessionToken });
    const body = await expectSuccessfulHoldingsResponse(response);

    expect(body.net_worth).toEqual({ currency: 'USD', value: 1000 });
    expect(body.holdings).toHaveLength(1);
    expect(body.holdings[0]?.asset.symbol).toBe('AAPL');
  });
});

async function sendHoldingsRequest(
  app: AppRequestClient,
  options: {
    sessionToken?: string;
  },
  headers?: Headers,
) {
  return app.request(HOLDINGS_PATH, {
    method: 'GET',
    headers: headers ?? createHoldingsRequestHeaders(options.sessionToken),
  });
}

async function sendHoldingsPreflightRequest(
  app: AppRequestClient,
  options: {
    sessionToken?: string;
  },
) {
  return app.request(HOLDINGS_PREFLIGHT_PATH, {
    method: 'GET',
    headers: createHoldingsRequestHeaders(options.sessionToken),
  });
}

function createHoldingsRequestHeaders(sessionToken?: string) {
  const headers = new Headers();

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulHoldingsPreflightResponse(response: Response) {
  expect(response.status).toBe(200);

  return PortfolioHoldingsPreflightResponseSchema.parse(await response.json());
}

async function expectSuccessfulHoldingsResponse(response: Response) {
  expect(response.status).toBe(200);

  return PortfolioHoldingsResponseSchema.parse(await response.json());
}

async function expectInternalServerErrorResponse(response: Response) {
  expect(response.status).toBe(500);

  return ErrorResponseSchema.parse(await response.json());
}
