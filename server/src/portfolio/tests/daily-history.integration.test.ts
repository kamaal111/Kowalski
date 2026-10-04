import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { seedPortfolioEntry, seedStockInfo } from './helpers.ts';
import { createApp } from '../../app.ts';
import { APP_API_BASE_PATH } from '../../constants/common.ts';
import type { Database } from '../../db/index.ts';
import { stockInfo, stockPriceHistoryCoverage } from '../../db/schema/index.ts';
import { integrationTest } from '../../tests/fixtures.ts';
import { buildChartMeta, yahooFinanceChartMock } from '../../tests/mocks/yahoo-finance.ts';
import { shiftDateByDays } from '../../utils/dates.ts';
import { createSyntheticTickerId } from '../../utils/tickers.ts';
import { PortfolioDashboardsResponseSchema } from '../schemas/responses.ts';

const PATH = `${APP_API_BASE_PATH}/portfolio/dashboards?period=all`;

const TICKER_ID = createSyntheticTickerId('NMS', 'AAPL');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-12T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('Daily dashboard history', () => {
  integrationTest(
    'fills daily closes between transactions and reuses the checked range',
    async ({ app, db, userId, sessionToken }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2026-01-09T12:00:00Z',
      });
      await seedStockInfo(db, { tickerId: TICKER_ID, date: '2026-01-12', currency: 'USD', price: 130 });
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110)],
      });

      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      const body = PortfolioDashboardsResponseSchema.parse(await response.json());
      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2026-01-09', value: 220, is_current: false },
        { date: '2026-01-10', value: 220, is_current: false },
        { date: '2026-01-11', value: 260, is_current: false },
        { date: '2026-01-12', value: 260, is_current: true },
      ]);
      const repeated = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(repeated.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenCalledOnce();
      expect(yahooFinanceChartMock).toHaveBeenCalledWith(
        'AAPL',
        {
          period1: '2025-12-30',
          period2: '2026-01-12',
          interval: '1d',
          return: 'array',
        },
        expect.objectContaining({ fetchOptions: expect.objectContaining({ signal: expect.any(AbortSignal) }) }),
      );
      const rows = await db.select().from(stockInfo).where(eq(stockInfo.tickerId, TICKER_ID));
      expect(rows.map(row => row.date).toSorted()).toEqual(['2026-01-09', '2026-01-12']);
    },
  );

  integrationTest(
    'fetches only the next historical day and replaces its earlier cached quote',
    async ({ app, db, userId, sessionToken }) => {
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2026-01-09T12:00:00Z',
      });
      await seedStockInfo(db, { tickerId: TICKER_ID, date: '2026-01-12', currency: 'USD', price: 130 });
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110)],
      });
      const first = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(first.status).toBe(200);
      vi.setSystemTime(new Date('2026-01-13T12:00:00Z'));
      await seedStockInfo(db, { tickerId: TICKER_ID, date: '2026-01-13', currency: 'USD', price: 150 });
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-12', 140)],
      });
      const second = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(second.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenNthCalledWith(
        2,
        'AAPL',
        {
          period1: '2026-01-12',
          period2: '2026-01-13',
          interval: '1d',
          return: 'array',
        },
        expect.objectContaining({ fetchOptions: expect.objectContaining({ signal: expect.any(AbortSignal) }) }),
      );

      const rows = await db
        .select()
        .from(stockInfo)
        .where(eq(stockInfo.id, `${TICKER_ID}:2026-01-12`));

      expect(rows).toHaveLength(1);
      expect(Number(rows[0]?.close)).toBe(140);
    },
  );

  integrationTest(
    'reuses weekend coverage across app instances without storing synthetic closes',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [],
      });
      const first = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(first.status).toBe(200);
      const second = await createApp(db).request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(second.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenCalledOnce();
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([
        { tickerId: TICKER_ID, startDate: '2025-12-30', endDate: '2026-01-11' },
      ]);
      expect(await db.select().from(stockInfo)).toHaveLength(1);
    },
  );

  integrationTest(
    'requests the earliest through latest uncovered gap despite cached transaction prices',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      await seedStockInfo(db, { tickerId: TICKER_ID, date: '2026-01-09', currency: 'USD', price: 105 });
      await db.insert(stockPriceHistoryCoverage).values([
        { tickerId: TICKER_ID, startDate: '2025-12-30', endDate: '2026-01-02' },
        { tickerId: TICKER_ID, startDate: '2026-01-05', endDate: '2026-01-06' },
        { tickerId: TICKER_ID, startDate: '2026-01-10', endDate: '2026-01-11' },
      ]);
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 115), candle('2026-01-09', 115), candle('2026-01-12', 999)],
      });
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenCalledExactlyOnceWith(
        'AAPL',
        {
          period1: '2026-01-03',
          period2: '2026-01-10',
          interval: '1d',
          return: 'array',
        },
        expect.any(Object),
      );
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([
        { tickerId: TICKER_ID, startDate: '2025-12-30', endDate: '2026-01-11' },
      ]);
      const rows = await db.select().from(stockInfo).orderBy(stockInfo.date);
      expect(rows.map(row => Number(row.close))).toEqual([115, 130]);
    },
  );

  integrationTest(
    'extends coverage only into older dates when the requested period widens',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId, '2025-12-01');
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [],
      });

      const week = await app.request(PATH.replace('period=all', 'period=1w'), {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      expect(week.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenNthCalledWith(
        1,
        'AAPL',
        {
          period1: '2025-12-26',
          period2: '2026-01-12',
          interval: '1d',
          return: 'array',
        },
        expect.any(Object),
      );
      const all = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(all.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenNthCalledWith(
        2,
        'AAPL',
        {
          period1: '2025-11-21',
          period2: '2025-12-26',
          interval: '1d',
          return: 'array',
        },
        expect.any(Object),
      );
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([
        { tickerId: TICKER_ID, startDate: '2025-11-21', endDate: '2026-01-11' },
      ]);
    },
  );

  integrationTest(
    'retries a failed Yahoo request without marking its range covered',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      yahooFinanceChartMock.mockRejectedValueOnce(new Error('Yahoo unavailable'));
      const failed = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(failed.status).toBe(200);
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110)],
      });
      const retried = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(retried.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenCalledTimes(2);
      expect(await db.select().from(stockPriceHistoryCoverage)).toHaveLength(1);
    },
  );

  integrationTest(
    'rejects malformed closes without persisting prices or coverage',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110), candle('2026-01-10', -1)],
      });
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
      expect(await db.select().from(stockInfo)).toHaveLength(1);
    },
  );

  integrationTest(
    'keeps null-close dates retryable while persisting valid surrounding prices',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110), candle('2026-01-10', null)],
      });
      const first = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(first.status).toBe(200);
      expect(await db.select().from(stockPriceHistoryCoverage).orderBy(stockPriceHistoryCoverage.startDate)).toEqual([
        { tickerId: TICKER_ID, startDate: '2025-12-30', endDate: '2026-01-09' },
        { tickerId: TICKER_ID, startDate: '2026-01-11', endDate: '2026-01-11' },
      ]);
      expect(await db.select().from(stockInfo)).toHaveLength(2);
      yahooFinanceChartMock.mockResolvedValueOnce({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [],
      });
      const second = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(second.status).toBe(200);
      expect(yahooFinanceChartMock).toHaveBeenNthCalledWith(
        2,
        'AAPL',
        {
          period1: '2026-01-10',
          period2: '2026-01-11',
          interval: '1d',
          return: 'array',
        },
        expect.any(Object),
      );
      expect(await db.select().from(stockPriceHistoryCoverage)).toHaveLength(1);
    },
  );

  integrationTest(
    'rolls back prices when coverage persistence fails and succeeds on retry',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      await db.execute(
        sql`alter table stock_price_history_coverage add constraint reject_coverage check (start_date > end_date) not valid`,
      );
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110)],
      });
      const first = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(first.status).toBe(500);
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
      expect(await db.select().from(stockInfo)).toHaveLength(1);
      await db.execute(sql`alter table stock_price_history_coverage drop constraint reject_coverage`);
      const retry = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(retry.status).toBe(200);
      expect(await db.select().from(stockInfo)).toHaveLength(2);
    },
  );

  integrationTest(
    'serializes simultaneous backfills across app instances with one Yahoo request',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);

      const chartResult = {
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110)],
      };

      const deferred = Promise.withResolvers<typeof chartResult>();
      yahooFinanceChartMock.mockReturnValue(deferred.promise);
      const first = app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      await vi.waitFor(() => expect(yahooFinanceChartMock).toHaveBeenCalledOnce());
      const second = createApp(db).request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      await vi.waitFor(async () => {
        const waiting = await db.execute<{ count: number }>(
          sql`select count(*)::int as count from pg_locks where locktype = 'advisory' and not granted and database = (select oid from pg_database where datname = current_database())`,
        );

        expect(waiting.rows[0]?.count).toBe(1);
      });
      deferred.resolve(chartResult);
      const responses = await Promise.all([first, second]);
      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(yahooFinanceChartMock).toHaveBeenCalledOnce();
      expect(await db.select().from(stockInfo)).toHaveLength(2);
      expect(await db.select().from(stockPriceHistoryCoverage)).toHaveLength(1);
    },
  );

  integrationTest(
    'stores more than one batch of daily closes even when the chart is sampled to fifty points',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId, '2021-01-01');

      const quotes = Array.from({ length: 1_500 }, (_, index) => candle(shiftDateByDays('2021-01-01', index), 110));

      yahooFinanceChartMock.mockResolvedValue({ meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }), quotes });
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      const body = PortfolioDashboardsResponseSchema.parse(await response.json());
      expect(body.portfolio_growth_over_time.points).toHaveLength(50);
      expect(body.portfolio_growth_over_time.points[0]).toEqual({ date: '2021-01-01', value: 110, is_current: false });
      expect(body.portfolio_growth_over_time.points.at(-1)).toEqual({
        date: '2026-01-12',
        value: 130,
        is_current: true,
      });
      expect(await db.select().from(stockInfo)).toHaveLength(1_501);
    },
  );

  integrationTest(
    'applies buys and sells on each day and retains zero values after liquidation',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'sell',
        transactionDate: '2026-01-11T12:00:00Z',
      });
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110)],
      });
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      const body = PortfolioDashboardsResponseSchema.parse(await response.json());
      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2026-01-09', value: 110, is_current: false },
        { date: '2026-01-10', value: 110, is_current: false },
        { date: '2026-01-11', value: 0, is_current: false },
        { date: '2026-01-12', value: 0, is_current: true },
      ]);
      expect(body.portfolio_holdings_distribution.holdings).toEqual([]);
    },
  );

  integrationTest(
    'enforces coverage range order and ticker ownership at the database boundary',
    async ({ db, userId }) => {
      await seedHistory(db, userId);
      await expect(
        db
          .insert(stockPriceHistoryCoverage)
          .values({ tickerId: TICKER_ID, startDate: '2026-01-11', endDate: '2026-01-09' }),
      ).rejects.toThrow();
      await expect(
        db
          .insert(stockPriceHistoryCoverage)
          .values({ tickerId: 'missing-ticker', startDate: '2026-01-09', endDate: '2026-01-11' }),
      ).rejects.toThrow();
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
    },
  );

  integrationTest('limits simultaneous ticker requests to four', async ({ app, db, userId, sessionToken }) => {
    for (const symbol of ['AAPL', 'MSFT', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX']) {
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol, exchange: 'NMS', name: symbol },
        amount: 1,
        purchasePrice: { currency: 'USD', value: 100 },
        transactionType: 'buy',
        transactionDate: '2026-01-09T12:00:00Z',
      });
      await seedStockInfo(db, {
        tickerId: createSyntheticTickerId('NMS', symbol),
        date: '2026-01-12',
        currency: 'USD',
        price: 130,
      });
    }

    const gate = Promise.withResolvers<undefined>();
    let active = 0;
    let maximumActive = 0;
    yahooFinanceChartMock.mockImplementation(async symbol => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await gate.promise;
      active -= 1;

      return { meta: buildChartMeta({ symbol, currency: 'USD' }), quotes: [candle('2026-01-09', 110)] };
    });
    const pending = app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
    await vi.waitFor(() => expect(yahooFinanceChartMock).toHaveBeenCalledTimes(4));
    expect(active).toBe(4);
    gate.resolve(undefined);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(maximumActive).toBe(4);
    expect(yahooFinanceChartMock).toHaveBeenCalledTimes(8);
    expect(await db.select().from(stockPriceHistoryCoverage)).toHaveLength(8);
  });

  integrationTest('does not fetch history for an unauthenticated request', async ({ app, db, userId }) => {
    await seedHistory(db, userId);
    const response = await app.request(PATH);
    expect(response.status).toBe(401);
    expect(yahooFinanceChartMock).not.toHaveBeenCalled();
    expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
  });

  integrationTest(
    'does not certify prices returned for a different symbol',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'MSFT', currency: 'USD' }),
        quotes: [candle('2026-01-09', 999)],
      });
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
      expect(await db.select().from(stockInfo)).toHaveLength(1);
    },
  );
  integrationTest(
    'uses resolved split holdings on daily dates without changing historical closes',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId);
      await seedPortfolioEntry(db, {
        userId,
        stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
        amount: 2,
        purchasePrice: { currency: 'USD', value: 110 },
        transactionType: 'split',
        transactionDate: '2026-01-10T12:00:00Z',
      });
      yahooFinanceChartMock.mockResolvedValue({
        meta: buildChartMeta({ symbol: 'AAPL', currency: 'USD' }),
        quotes: [candle('2026-01-09', 110), candle('2026-01-10', 55)],
      });
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      const body = PortfolioDashboardsResponseSchema.parse(await response.json());
      expect(body.portfolio_growth_over_time.points).toEqual([
        { date: '2026-01-09', value: 110, is_current: false },
        { date: '2026-01-10', value: 110, is_current: false },
        { date: '2026-01-11', value: 110, is_current: false },
        { date: '2026-01-12', value: 260, is_current: true },
      ]);
    },
  );

  integrationTest(
    'keeps a purchase made today as the current point without a history fetch',
    async ({ app, db, userId, sessionToken }) => {
      await seedHistory(db, userId, '2026-01-12');
      const response = await app.request(PATH, { headers: { Authorization: `Bearer ${sessionToken}` } });
      expect(response.status).toBe(200);
      const body = PortfolioDashboardsResponseSchema.parse(await response.json());
      expect(body.portfolio_growth_over_time.points).toEqual([{ date: '2026-01-12', value: 130, is_current: true }]);
      expect(yahooFinanceChartMock).not.toHaveBeenCalled();
      expect(await db.select().from(stockPriceHistoryCoverage)).toEqual([]);
    },
  );
});

async function seedHistory(db: Database, userId: string, date = '2026-01-09') {
  await seedPortfolioEntry(db, {
    userId,
    stock: { symbol: 'AAPL', exchange: 'NMS', name: 'Apple Inc.' },
    amount: 1,
    purchasePrice: { currency: 'USD', value: 100 },
    transactionType: 'buy',
    transactionDate: `${date}T12:00:00Z`,
  });
  await seedStockInfo(db, { tickerId: TICKER_ID, date: '2026-01-12', currency: 'USD', price: 130 });
}

function candle(date: string, close: number | null) {
  return { date: new Date(`${date}T12:00:00Z`), close, high: null, low: null, open: null, volume: null };
}
