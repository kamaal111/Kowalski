import { describe, expect } from 'vitest';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { PortfolioDashboardsResponseSchema } from '../schemas/responses';
import { seedExchangeRate, seedPortfolioEntry, seedStockInfo } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import { ValidationErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { yahooFinanceChartMock, yahooFinanceQuoteMock } from '@/tests/mocks/yahoo-finance';
import { createTestUserAndSession } from '@/tests/utils';
import { createSyntheticTickerId } from '@/utils/tickers';

const DASHBOARDS_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/dashboards`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Portfolio Dashboards Route', () => {
  integrationTest('defaults dashboard period to one year', async ({ app, db, sessionToken, userId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const oldDate = shiftDateByDays(today, -450);
    const recentDate = shiftDateByDays(today, -30);
    const baselineDate = shiftDateByDays(today, -365);
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 100 },
      transactionType: 'buy',
      transactionDate: dateTime(oldDate),
    });
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'MSFT', exchange: 'NMS', name: 'Microsoft Corporation' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 200 },
      transactionType: 'buy',
      transactionDate: dateTime(recentDate),
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: baselineDate,
      price: 150,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: recentDate,
      price: 160,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'MSFT'),
      currency: 'USD',
      date: recentDate,
      price: 250,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: today,
      price: 170,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'MSFT'),
      currency: 'USD',
      date: today,
      price: 260,
    });

    const defaultResponse = await sendDashboardsRequest(app, sessionToken);
    const explicitResponse = await sendDashboardsRequest(app, sessionToken, {}, '1y');

    expect(await expectSuccessfulDashboardsResponse(defaultResponse)).toEqual(
      await expectSuccessfulDashboardsResponse(explicitResponse),
    );
  });

  integrationTest('filters transaction snapshots to the selected period', async ({ app, db, sessionToken, userId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const oldDate = shiftDateByDays(today, -10);
    const recentDate = shiftDateByDays(today, -2);
    const baselineDate = shiftDateByDays(today, -7);
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 100 },
      transactionType: 'buy',
      transactionDate: dateTime(oldDate),
    });
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'MSFT', exchange: 'NMS', name: 'Microsoft Corporation' },
      amount: 1,
      purchasePrice: { currency: 'USD', value: 200 },
      transactionType: 'buy',
      transactionDate: dateTime(recentDate),
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: baselineDate,
      price: 150,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: recentDate,
      price: 160,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'MSFT'),
      currency: 'USD',
      date: recentDate,
      price: 250,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: today,
      price: 170,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'MSFT'),
      currency: 'USD',
      date: today,
      price: 260,
    });

    const response = await sendDashboardsRequest(app, sessionToken, {}, '1w');
    const body = await expectSuccessfulDashboardsResponse(response);

    expect(body.portfolio_growth_over_time.points.map(point => point.date)).toEqual([baselineDate, recentDate, today]);
    expect(body.portfolio_growth_over_time.points.map(point => point.value)).toEqual([150, 410, 430]);
  });

  integrationTest(
    'returns a period baseline when holdings existed before the period',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      const oldDate = shiftDateByDays(today, -730);
      const baselineDate = shiftDateByDays(today, -365);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: dateTime(oldDate),
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: baselineDate,
        price: 150,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: today,
        price: 160,
      });

      const response = await sendDashboardsRequest(app, sessionToken, {}, '1y');
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: baselineDate, value: 300, is_current: false },
        { date: today, value: 320, is_current: true },
      ]);
    },
  );

  integrationTest('returns all transaction snapshots for the all period', async ({ app, db, sessionToken, userId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const oldDate = shiftDateByDays(today, -730);
    await seedPortfolioEntry(db, {
      userId,
      stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
      amount: 2,
      purchasePrice: { currency: 'USD', value: 100 },
      transactionType: 'buy',
      transactionDate: dateTime(oldDate),
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: oldDate,
      price: 150,
    });
    await seedStockInfo(db, {
      tickerId: createSyntheticTickerId('NMS', 'AAPL'),
      currency: 'USD',
      date: today,
      price: 160,
    });

    const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
    const body = await expectSuccessfulDashboardsResponse(response);

    expect(body.portfolio_growth_over_time.points).toEqual([
      { date: oldDate, value: 300, is_current: false },
      { date: today, value: 320, is_current: true },
    ]);
  });

  integrationTest(
    'caps dashboard growth points at fifty and keeps current',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      for (let index = 60; index >= 1; index -= 1) {
        const date = shiftDateByDays(today, -index);
        await seedPortfolioEntry(db, {
          userId,
          stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
          amount: 1,
          purchasePrice: { currency: 'USD', value: 100 },
          transactionType: 'buy',
          transactionDate: dateTime(date),
        });
        await seedStockInfo(db, {
          tickerId: createSyntheticTickerId('NMS', 'AAPL'),
          currency: 'USD',
          date,
          price: 100,
        });
      }
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: today,
        price: 100,
      });

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
      const body = await expectSuccessfulDashboardsResponse(response);
      const points = body.portfolio_growth_over_time.points;

      expect(points).toHaveLength(50);
      expect(points.at(-1)).toEqual({ date: today, value: 6000, is_current: true });
      expect(points.filter(point => point.is_current)).toHaveLength(1);
    },
    15_000,
  );

  integrationTest('rejects invalid dashboard periods', async ({ app, sessionToken }) => {
    const response = await sendDashboardsRequest(app, sessionToken, {}, 'bogus');
    const body = await expectValidationResponse(response);

    expect(body.context?.validations.some(validation => validation.path.includes('period'))).toBe(true);
  });

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

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
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
    'calculates dashboard snapshots from chronological entries when the repository returns newest first',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 5,
        purchasePrice: { currency: 'USD', value: 200 },
        transactionType: 'buy',
        transactionDate: '2024-06-15T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 5,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'sell',
        transactionDate: '2024-03-15T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2024-01-15T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', 'AAPL'),
        currency: 'USD',
        date: today,
        price: 250,
      });

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-01-15', value: 1000, is_current: false },
        { date: '2024-03-15', value: 500, is_current: false },
        { date: '2024-06-15', value: 1500, is_current: false },
        { date: today, value: 2500, is_current: true },
      ]);
      expect(yahooFinanceChartMock).toHaveBeenCalledWith('AAPL', {
        period1: '2024-01-05',
        period2: '2024-06-21',
        interval: '1d',
        return: 'array',
      });
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

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
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

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
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

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-01-15', value: 100, is_current: false },
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
    'uses purchase price fallbacks for snapshots without a bounded close price',
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
      const response = await sendDashboardsRequest(app, sessionToken, headers, 'all');
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-01-15', value: 100, is_current: false },
        { date: today, value: 160, is_current: true },
      ]);
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
            msg: 'Portfolio dashboard could not resolve every historical close price; purchase price fallbacks may be used.',
          }),
        ]),
      );
    },
  );

  integrationTest(
    'uses market closes for same-ticker buys with mixed purchase currencies',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'XYZ', exchange: 'NYQ', name: 'Block Inc.' },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2024-01-15T10:30:00.000Z',
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'XYZ', exchange: 'NYQ', name: 'Block Inc.' },
        amount: 2,
        purchasePrice: { currency: 'EUR', value: 70 },
        transactionType: 'buy',
        transactionDate: '2024-06-15T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: '2024-01-15',
        price: 110,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: '2024-06-15',
        price: 120,
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NYQ', 'XYZ'),
        currency: 'USD',
        date: today,
        price: 130,
      });

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-01-15', value: 110, is_current: false },
        { date: '2024-06-15', value: 360, is_current: false },
        { date: today, value: 390, is_current: true },
      ]);
      expect(yahooFinanceChartMock).not.toHaveBeenCalled();
      expect(yahooFinanceQuoteMock).not.toHaveBeenCalled();
    },
  );

  integrationTest(
    'converts purchase price fallbacks into the preferred currency',
    async ({ app, db, sessionToken, userId }) => {
      const today = new Date().toISOString().slice(0, 10);
      await seedExchangeRate(db, {
        base: 'USD',
        date: today,
        rates: { DKK: 2 },
      });
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'NOVO-B.CO', exchange: 'CPH', name: 'Novo Nordisk A/S' },
        amount: 2,
        purchasePrice: { currency: 'DKK', value: 100 },
        transactionType: 'buy',
        transactionDate: '2024-01-15T10:30:00.000Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('CPH', 'NOVO-B.CO'),
        currency: 'DKK',
        date: today,
        price: 120,
      });

      const response = await sendDashboardsRequest(app, sessionToken, {}, 'all');
      const body = await expectSuccessfulDashboardsResponse(response);

      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2024-01-15', value: 100, is_current: false },
        { date: today, value: 120, is_current: true },
      ]);
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

async function sendDashboardsRequest(
  app: AppRequestClient,
  sessionToken: string,
  headers: HeadersInit = {},
  period?: string,
) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Authorization', `Bearer ${sessionToken}`);
  const path = period == null ? DASHBOARDS_PATH : `${DASHBOARDS_PATH}?period=${period}`;

  return app.request(path, {
    headers: requestHeaders,
  });
}

async function expectSuccessfulDashboardsResponse(response: Response) {
  expect(response.status).toBe(200);

  return PortfolioDashboardsResponseSchema.parse(await response.json());
}

async function expectValidationResponse(response: Response) {
  expect(response.status).toBe(400);

  return ValidationErrorResponseSchema.parse(await response.json());
}

function dateTime(date: string) {
  return `${date}T10:30:00.000Z`;
}

function shiftDateByDays(date: string, days: number) {
  const shiftedDate = new Date(`${date}T00:00:00.000Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);

  return shiftedDate.toISOString().slice(0, 10);
}
