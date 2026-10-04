import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type { HonoContext } from '../../api/contexts.ts';
import type { Database } from '../../db/index.ts';
import { stockInfo, stockPriceHistoryCoverage } from '../../db/schema/index.ts';
import { CurrencySchema, type Currency } from '../../forex/constants.ts';
import { shiftDateByDays } from '../../utils/dates.ts';
import { assertToFloat } from '../../utils/numbers.ts';
import { HISTORICAL_PRICE_BATCH_SIZE } from '../constants.ts';

export interface PersistedStockPrice {
  tickerId: string;
  currency: Currency;
  date: string;
  close: number;
}

export type StockPriceDateRange = Pick<typeof stockPriceHistoryCoverage.$inferSelect, 'startDate' | 'endDate'>;

interface HistoricalPriceAccess {
  findCoverage: () => Promise<StockPriceDateRange[]>;
  store: (prices: PersistedStockPrice[], ranges: StockPriceDateRange[]) => Promise<void>;
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
    .selectDistinctOn([stockInfo.tickerId], {
      tickerId: stockInfo.tickerId,
      currency: stockInfo.currency,
      date: stockInfo.date,
      close: stockInfo.close,
    })
    .from(stockInfo)
    .where(inArray(stockInfo.tickerId, tickerIds))
    .orderBy(asc(stockInfo.tickerId), desc(stockInfo.date));

  return rows.map(mapStockPriceRow);
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

export async function insertStockPrices(c: HonoContext, prices: PersistedStockPrice[]) {
  if (prices.length === 0) {
    return;
  }

  await c.get('db').insert(stockInfo).values(prices.map(mapStockPriceToInsertRow)).onConflictDoNothing();
}

function mapStockPriceRow(row: {
  tickerId: string;
  currency: string;
  date: string;
  close: string | number;
}): PersistedStockPrice {
  return {
    tickerId: row.tickerId,
    currency: CurrencySchema.parse(row.currency),
    date: row.date,
    close: assertToFloat(row.close),
  };
}

function createStockPriceId(tickerId: string, date: string) {
  return `${tickerId}:${date}`;
}

function mapStockPriceToInsertRow(price: PersistedStockPrice): typeof stockInfo.$inferInsert {
  return {
    id: createStockPriceId(price.tickerId, price.date),
    tickerId: price.tickerId,
    currency: price.currency,
    date: price.date,
    close: price.close.toString(),
  };
}

export async function findHistoricalPriceCoverage(c: HonoContext, tickerIds: string[]) {
  return selectHistoricalPriceCoverage(c.get('db'), tickerIds);
}

async function selectHistoricalPriceCoverage(db: Pick<Database, 'select'>, tickerIds: string[]) {
  if (tickerIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(stockPriceHistoryCoverage)
    .where(inArray(stockPriceHistoryCoverage.tickerId, tickerIds))
    .orderBy(asc(stockPriceHistoryCoverage.tickerId), asc(stockPriceHistoryCoverage.startDate));
}

export async function withLockedHistoricalTicker<T>(
  c: HonoContext,
  tickerId: string,
  callback: (access: HistoricalPriceAccess) => Promise<T>,
): Promise<T> {
  return c.get('db').transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`stock-history:${tickerId}`}, 0))`);

    const findCoverage = (): Promise<StockPriceDateRange[]> => selectHistoricalPriceCoverage(tx, [tickerId]);

    return callback({
      findCoverage,
      store: async (prices, ranges) => {
        for (let offset = 0; offset < prices.length; offset += HISTORICAL_PRICE_BATCH_SIZE) {
          await tx
            .insert(stockInfo)
            .values(
              prices
                .slice(offset, offset + HISTORICAL_PRICE_BATCH_SIZE)
                .map(price => mapStockPriceToInsertRow({ ...price, tickerId })),
            )
            .onConflictDoUpdate({
              target: [stockInfo.tickerId, stockInfo.date],
              set: { close: sql`excluded.rate`, currency: sql`excluded.currency` },
            });
        }

        const merged: StockPriceDateRange[] = [];
        const coverages = await findCoverage();
        coverages
          .concat(ranges)
          .toSorted((a, b) => a.startDate.localeCompare(b.startDate))
          .forEach(range => {
            const previous = merged.at(-1);

            if (previous != null && range.startDate <= shiftDateByDays(previous.endDate, 1)) {
              previous.endDate = previous.endDate > range.endDate ? previous.endDate : range.endDate;
            } else {
              merged.push({ ...range });
            }
          });

        await tx.delete(stockPriceHistoryCoverage).where(eq(stockPriceHistoryCoverage.tickerId, tickerId));

        for (let offset = 0; offset < merged.length; offset += HISTORICAL_PRICE_BATCH_SIZE) {
          await tx
            .insert(stockPriceHistoryCoverage)
            .values(merged.slice(offset, offset + HISTORICAL_PRICE_BATCH_SIZE).map(range => ({ tickerId, ...range })));
        }
      },
    });
  });
}
