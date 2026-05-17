import { describe, expect, vi } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { PortfolioOverviewPreflightResponseSchema } from '../schemas/responses';
import { seedPortfolioEntry, seedStockInfo } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import { integrationTest } from '@/tests/fixtures';
import { yahooFinanceQuoteMock } from '@/tests/mocks/yahoo-finance';
import { createTestUserAndSession } from '@/tests/utils';
import { createSyntheticTickerId } from '@/utils/tickers';

const OVERVIEW_PREFLIGHT_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/overview/preflight`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Portfolio Overview Preflight Route', () => {
  integrationTest('returns ready preflight when portfolio is empty', async ({ app, sessionToken }) => {
    const response = await sendOverviewPreflightRequest(app, { sessionToken });
    const body = await expectSuccessfulOverviewPreflightResponse(response);

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

      const response = await sendOverviewPreflightRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewPreflightResponse(response);

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

      const response = await sendOverviewPreflightRequest(app, { sessionToken });
      const body = await expectSuccessfulOverviewPreflightResponse(response);

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
        sendOverviewPreflightRequest(app, { sessionToken }),
        sendOverviewPreflightRequest(app, { sessionToken }),
      ]);
      const bodies = await Promise.all(responses.map(expectSuccessfulOverviewPreflightResponse));

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

      const firstResponse = await sendOverviewPreflightRequest(app, { sessionToken });
      const firstBody = await expectSuccessfulOverviewPreflightResponse(firstResponse);
      await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledOnce());
      const secondResponse = await sendOverviewPreflightRequest(app, { sessionToken });
      const secondBody = await expectSuccessfulOverviewPreflightResponse(secondResponse);

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

    await expectSuccessfulOverviewPreflightResponse(await sendOverviewPreflightRequest(app, { sessionToken }));
    await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledOnce());
    const otherUserResponse = await sendOverviewPreflightRequest(app, { sessionToken: otherUser.token });
    const otherUserBody = await expectSuccessfulOverviewPreflightResponse(otherUserResponse);

    expect(otherUserBody.refresh_state).toBe('refreshing');
    await vi.waitFor(() => expect(yahooFinanceQuoteMock).toHaveBeenCalledTimes(2));
  });
});

async function sendOverviewPreflightRequest(
  app: AppRequestClient,
  options: {
    sessionToken?: string;
  },
) {
  return app.request(OVERVIEW_PREFLIGHT_PATH, {
    method: 'GET',
    headers: createOverviewPreflightRequestHeaders(options.sessionToken),
  });
}

function createOverviewPreflightRequestHeaders(sessionToken?: string) {
  const headers = new Headers();

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulOverviewPreflightResponse(response: Response) {
  expect(response.status).toBe(200);

  return PortfolioOverviewPreflightResponseSchema.parse(await response.json());
}
