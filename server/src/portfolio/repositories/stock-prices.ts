import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { stockInfo } from '@/db/schema';
import { CurrencyShape, type Currency } from '@/forex/constants';
import { assertToFloat } from '@/utils/numbers';

export interface PersistedStockPrice {
  tickerId: string;
  currency: Currency;
  date: string;
  close: number;
}

interface InsertStockPriceInput {
  tickerId: string;
  currency: Currency;
  date: string;
  close: number;
}

export async function findTodayStockPricesByTickerIds(
  c: HonoContext,
  tickerIds: string[],
  today: string,
): Promise<PersistedStockPrice[]> {
  if (tickerIds.length === 0) {
    return [];
  }

  const rows = await c
    .get('db')
    .select({
      tickerId: stockInfo.tickerId,
      currency: stockInfo.currency,
      date: stockInfo.date,
      close: stockInfo.close,
    })
    .from(stockInfo)
    .where(and(inArray(stockInfo.tickerId, tickerIds), eq(stockInfo.date, today)))
    .orderBy(asc(stockInfo.tickerId));

  return rows.map(mapStockPriceRow);
}

export async function findLatestStockPricesByTickerIds(
  c: HonoContext,
  tickerIds: string[],
): Promise<PersistedStockPrice[]> {
  if (tickerIds.length === 0) {
    return [];
  }

  const rows = await c
    .get('db')
    .select({
      tickerId: stockInfo.tickerId,
      currency: stockInfo.currency,
      date: stockInfo.date,
      close: stockInfo.close,
    })
    .from(stockInfo)
    .where(inArray(stockInfo.tickerId, tickerIds))
    .orderBy(asc(stockInfo.tickerId), desc(stockInfo.date));
  const latestRows = rows.reduce((acc, row) => {
    if (acc.has(row.tickerId)) {
      return acc;
    }

    return acc.set(row.tickerId, mapStockPriceRow(row));
  }, new Map<string, PersistedStockPrice>());

  return [...latestRows.values()];
}

export async function findStockPricesByTickerIdsOnOrBeforeDate(
  c: HonoContext,
  tickerIds: string[],
  date: string,
): Promise<PersistedStockPrice[]> {
  if (tickerIds.length === 0) {
    return [];
  }

  const rows = await c
    .get('db')
    .select({
      tickerId: stockInfo.tickerId,
      currency: stockInfo.currency,
      date: stockInfo.date,
      close: stockInfo.close,
    })
    .from(stockInfo)
    .where(and(inArray(stockInfo.tickerId, tickerIds), lte(stockInfo.date, date)))
    .orderBy(asc(stockInfo.tickerId), desc(stockInfo.date));

  return rows
    .reduce((acc, row) => {
      if (acc.has(row.tickerId)) {
        return acc;
      }

      return acc.set(row.tickerId, mapStockPriceRow(row));
    }, new Map<string, PersistedStockPrice>())
    .values()
    .toArray();
}

export async function findStockPricesByTickerIdsBetweenDates(
  c: HonoContext,
  tickerIds: string[],
  startDate: string,
  endDate: string,
): Promise<PersistedStockPrice[]> {
  if (tickerIds.length === 0) {
    return [];
  }

  const rows = await c
    .get('db')
    .select({
      tickerId: stockInfo.tickerId,
      currency: stockInfo.currency,
      date: stockInfo.date,
      close: stockInfo.close,
    })
    .from(stockInfo)
    .where(and(inArray(stockInfo.tickerId, tickerIds), gte(stockInfo.date, startDate), lte(stockInfo.date, endDate)))
    .orderBy(asc(stockInfo.tickerId), desc(stockInfo.date));

  return rows.map(mapStockPriceRow);
}

export async function findLatestCachedPriceDateByTickerIds(
  c: HonoContext,
  tickerIds: string[],
): Promise<string | null> {
  if (tickerIds.length === 0) {
    return null;
  }

  const rows = await c
    .get('db')
    .select({ date: stockInfo.date })
    .from(stockInfo)
    .where(inArray(stockInfo.tickerId, tickerIds))
    .orderBy(desc(stockInfo.date))
    .limit(1);

  return rows[0]?.date ?? null;
}

export async function insertStockPrices(c: HonoContext, prices: InsertStockPriceInput[]) {
  if (prices.length === 0) {
    return;
  }

  await c
    .get('db')
    .insert(stockInfo)
    .values(
      prices.map(price => ({
        id: createStockPriceId(price.tickerId, price.date),
        currency: price.currency,
        date: price.date,
        close: price.close.toString(),
        tickerId: price.tickerId,
      })),
    )
    .onConflictDoNothing();
}

function mapStockPriceRow(row: {
  tickerId: string;
  currency: string;
  date: string;
  close: string | number;
}): PersistedStockPrice {
  return {
    tickerId: row.tickerId,
    currency: CurrencyShape.parse(row.currency),
    date: row.date,
    close: assertToFloat(row.close),
  };
}

function createStockPriceId(tickerId: string, date: string) {
  return `${tickerId}:${date}`;
}
