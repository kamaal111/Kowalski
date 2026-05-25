import { describe, expect } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { PortfolioDashboardsResponseSchema } from '../schemas/responses';
import { seedPortfolioEntry, seedStockInfo } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import { integrationTest } from '@/tests/fixtures';
import { yahooFinanceChartMock, yahooFinanceQuoteMock } from '@/tests/mocks/yahoo-finance';
import { createTestUserAndSession } from '@/tests/utils';
import { createSyntheticTickerId } from '@/utils/tickers';

const DASHBOARDS_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/dashboards`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Portfolio Dashboards Route', () => {
  integrationTest(
    'returns growth points for transaction dates plus current value',
    async ({ app, db, sessionToken, userId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2025-12-19T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'MSFT', exchange: 'NMS', name: 'Microsoft Corporation' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 300 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });
      const today = new Date().toISOString().slice(0, 10);
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: '2025-12-19',
        price: 150,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: '2025-12-20',
        price: 155,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'MSFT'),
        currency: 'USD',
        date: '2025-12-20',
        price: 420,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: today,
        price: 160,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'MSFT'),
        currency: 'USD',
        date: today,
        price: 430,
      });

      const response = await sendDashboardsRequest(app, sessionToken);
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time).toEqual({
        currency: 'USD',
        points: [
          { date: '2025-12-19', value: 1500, is_current: false },
          { date: '2025-12-20', value: 2390, is_current: false },
          { date: today, value: 2460, is_current: true },
        ],
      });
      expect(yahooFinanceChartMock).not.toHaveBeenCalled();
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
    },
  );

  integrationTest(
    'fetches one Yahoo chart date range per missing ticker timeline',
    async ({ app, db, sessionToken, userId }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 3,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 120 },
        transactionType: 'buy',
        transactionDate: '2025-12-22T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: new Date().toISOString().slice(0, 10),
        price: 160,
      });

      const response = await sendDashboardsRequest(app, sessionToken);
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        {
          date: '2025-12-20',
          value: 450,
          is_current: false,
        },
        {
          date: '2025-12-22',
          value: 640,
          is_current: false,
        },
        {
          date: new Date().toISOString().slice(0, 10),
          value: 640,
          is_current: true,
        },
      ]);
      expect(yahooFinanceChartMock).toHaveBeenCalledTimes(1);
      expect(yahooFinanceChartMock).toHaveBeenCalledWith('AAPL', {
        period1: '2025-12-10',
        period2: '2025-12-28',
        interval: '1d',
        return: 'array',
      });
    },
  );

  integrationTest(
    'uses the closest available market close when a snapshot date has no candle',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'XYZ', exchange: 'NYQ', name: 'Block Inc.' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 50 },
        transactionType: 'buy',
        transactionDate: '2024-01-15T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: today,
        price: 80,
      });
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: { currency: 'USD' },
        quotes: [
          {
            date: new Date('2024-01-16T00:00:00.000Z'),
            close: 55,
            high: null,
            low: null,
            open: null,
            volume: null,
          },
        ],
      });

      const response = await sendDashboardsRequest(app, sessionToken);
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-01-15', value: 110, is_current: false },
        { date: today, value: 160, is_current: true },
      ]);
      expect(yahooFinanceChartMock).toHaveBeenCalledWith('XYZ', {
        period1: '2024-01-05',
        period2: '2024-01-21',
        interval: '1d',
        return: 'array',
      });
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
    },
  );

  integrationTest(
    'does not resolve an old snapshot from a far-away cached close for the same ticker',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'XYZ', exchange: 'NYQ', name: 'Block Inc.' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 50 },
        transactionType: 'buy',
        transactionDate: '2024-01-15T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'XYZ', exchange: 'NYQ', name: 'Block Inc.' },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 60 },
        transactionType: 'buy',
        transactionDate: '2024-06-15T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: '2024-06-16',
        price: 90,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: today,
        price: 100,
      });

      const response = await sendDashboardsRequest(app, sessionToken);
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-06-15', value: 270, is_current: false },
        { date: today, value: 300, is_current: true },
      ]);
      expect(yahooFinanceChartMock).toHaveBeenCalledWith('XYZ', {
        period1: '2024-01-05',
        period2: '2024-06-21',
        interval: '1d',
        return: 'array',
      });
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
    },
  );

  integrationTest(
    'omits historical snapshots that cannot resolve a bounded close price',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'XYZ', exchange: 'NYQ', name: 'Block Inc.' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 50 },
        transactionType: 'buy',
        transactionDate: '2024-01-15T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: today,
        price: 80,
      });

      const { headers, requestId } = withRequestId();
      const response = await sendDashboardsRequest(app, sessionToken, headers);
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([{ date: today, value: 160, is_current: true }]);
      expect(yahooFinanceChartMock).toHaveBeenCalledWith('XYZ', {
        period1: '2024-01-05',
        period2: '2024-01-21',
        interval: '1d',
        return: 'array',
      });
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
      expect(getLogsForRequestId(requestId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.dashboards.historical_prices.unresolved',
            msg: 'Portfolio dashboard could not resolve every historical close price; affected snapshots will be omitted.',
          }),
          expect.objectContaining({
            event: 'portfolio.dashboards.growth_snapshots_omitted',
            msg: 'Portfolio dashboard omitted growth snapshots because historical prices were incomplete.',
          }),
        ]),
      );
    },
  );

  integrationTest('does not return another user dashboard transactions', async ({ app, db, sessionToken, userId }) => {
    const otherUser = await createTestUserAndSession(db);
    const today = new Date().toISOString().slice(0, 10);
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 100 },
      transactionType: 'buy',
      transactionDate: '2025-12-19T10:30:00.000Z',
    });
    await seedPortfolioEntry(db, {
      userId: otherUser.userId,
      stock: { symbol: 'MSFT', exchange: 'NMS', name: 'Microsoft Corporation' },
      amount: 10,
      purchasePrice: { currency: 'USD', value: 300 },
      transactionType: 'buy',
      transactionDate: '2025-12-20T10:30:00.000Z',
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: '2025-12-19',
      price: 150,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: today,
      price: 160,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'MSFT'),
      currency: 'USD',
      date: '2025-12-20',
      price: 420,
    });

    const response = await sendDashboardsRequest(app, sessionToken);
    const body = await expectSuccessfulDashboardsResponse(response);

    expect(body.portfolio_growth_over_time.points).toEqual([
      { date: '2025-12-19', value: 150, is_current: false },
      { date: today, value: 160, is_current: true },
    ]);
  });

  integrationTest('returns empty growth data when the user has no entries', async ({ app, sessionToken }) => {
    const response = await sendDashboardsRequest(app, sessionToken);
    const body = await expectSuccessfulDashboardsResponse(response);

    expect(body).toEqual({
      portfolio_growth_over_time: {
        currency: 'USD',
        points: [],
      },
    });
    expect(yahooFinanceChartMock).not.toHaveBeenCalled();
    expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
  });
});

async function sendDashboardsRequest(app: AppRequestClient, sessionToken: string, headers: HeadersInit = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Authorization', `Bearer ${sessionToken}`);

  return app.request(DASHBOARDS_PATH, {
    headers: requestHeaders,
  });
}

async function expectSuccessfulDashboardsResponse(response: Response) {
  expect(response.status).toBe(200);

  return PortfolioDashboardsResponseSchema.parse(await response.json());
}
