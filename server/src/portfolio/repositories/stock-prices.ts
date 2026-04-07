import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { stockInfo } from '@/db/schema';
import { assertToFloat } from '@/utils/numbers';

export interface PersistedStockPrice {
  tickerId: string;
  currency: string;
  date: string;
  close: number;
}

interface InsertStockPriceInput {
  tickerId: string;
  currency: string;
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
  return { tickerId: row.tickerId, currency: row.currency, date: row.date, close: assertToFloat(row.close) };
}

function createStockPriceId(tickerId: string, date: string) {
  return `${tickerId}:${date}`;
}
