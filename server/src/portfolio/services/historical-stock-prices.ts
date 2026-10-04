import { fetchYahooChartPrices } from './yahoo-chart.ts';
import type { HonoContext } from '../../api/contexts.ts';
import { withRequestLogger } from '../../logging/http.ts';
import { logError, logInfo } from '../../logging/index.ts';
import { shiftDateByDays } from '../../utils/dates.ts';
import { MAX_HISTORICAL_PRICE_CONCURRENCY } from '../constants.ts';
import { StockPriceFetchFailed } from '../exceptions.ts';
import {
  findHistoricalPriceCoverage,
  withLockedHistoricalTicker,
  type StockPriceDateRange,
} from '../repositories/stock-prices.ts';

interface HistoricalTickerRange extends StockPriceDateRange {
  tickerId: string;
  stockSymbol: string;
}

export async function resolveHistoricalStockPrices(c: HonoContext, ranges: HistoricalTickerRange[]): Promise<void> {
  if (ranges.length === 0) {
    return;
  }

  const logger = withRequestLogger(c, { component: 'portfolio' });

  try {
    const coverage = await findHistoricalPriceCoverage(
      c,
      ranges.map(range => range.tickerId),
    );

    const coverageByTicker = coverage.reduce((coverageByTicker, row) => {
      const existing = coverageByTicker.get(row.tickerId) ?? [];
      existing.push(row);

      return coverageByTicker.set(row.tickerId, existing);
    }, new Map<string, StockPriceDateRange[]>());

    const missing = ranges.filter(range => findGaps(range, coverageByTicker.get(range.tickerId) ?? []).length > 0);
    let nextIndex = 0;
    let failedTickerCount = 0;
    let cachedTickerCount = ranges.length - missing.length;

    const results = await Promise.allSettled(
      Array.from({ length: Math.min(MAX_HISTORICAL_PRICE_CONCURRENCY, missing.length) }, async () => {
        while (nextIndex < missing.length) {
          const range = missing[nextIndex];
          nextIndex += 1;

          const backfill = await withLockedHistoricalTicker(c, range.tickerId, async access => {
            const gaps = findGaps(range, await access.findCoverage());
            const first = gaps[0];
            const last = gaps.at(-1);

            if (first == null || last == null) {
              cachedTickerCount += 1;

              return null;
            }

            const result = await fetchYahooChartPrices(c, {
              symbol: range.stockSymbol,
              period1: first.startDate,
              period2: shiftDateByDays(last.endDate, 1),
            });

            if (!result.success) {
              failedTickerCount += 1;

              return null;
            }

            const prices = result.prices.map(price => ({
              tickerId: range.tickerId,
              currency: price.currency,
              date: price.date,
              close: price.price,
            }));

            const checkedRanges = findGaps(
              { startDate: first.startDate, endDate: last.endDate },
              result.missingDates.map(date => ({ startDate: date, endDate: date })),
            );

            await access.store(prices, checkedRanges);

            return {
              startDate: first.startDate,
              endDate: last.endDate,
              storedCount: prices.length,
              missingDateCount: result.missingDates.length,
            };
          });

          if (backfill != null) {
            logInfo(
              logger,
              {
                event: 'portfolio.stock_prices.history.backfilled',
                quote_symbol: range.stockSymbol,
                period_start: backfill.startDate,
                period_end: backfill.endDate,
                stored_count: backfill.storedCount,
                missing_date_count: backfill.missingDateCount,
                partial: backfill.missingDateCount > 0,
                outcome: 'success',
              },
              'Stored historical closes and checked date ranges.',
            );
          }
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason;
      }
    }

    logInfo(
      logger,
      {
        event: 'portfolio.stock_prices.history.resolved',
        ticker_count: ranges.length,
        cached_ticker_count: cachedTickerCount,
        failed_ticker_count: failedTickerCount,
        partial: failedTickerCount > 0,
        outcome: failedTickerCount > 0 ? 'failure' : 'success',
      },
      'Finished resolving historical price coverage.',
    );
  } catch (error) {
    logError(
      logger,
      { event: 'portfolio.stock_prices.history.persistence_failed', outcome: 'failure' },
      error,
      'Failed to persist historical closes and date coverage.',
    );
    throw new StockPriceFetchFailed(c);
  }
}

function findGaps(required: StockPriceDateRange, coverage: StockPriceDateRange[]): StockPriceDateRange[] {
  const gaps: StockPriceDateRange[] = [];
  let cursor = required.startDate;

  for (const range of coverage) {
    if (range.endDate < cursor) {
      continue;
    }

    if (range.startDate > required.endDate) {
      break;
    }

    if (range.startDate > cursor) {
      gaps.push({ startDate: cursor, endDate: shiftDateByDays(range.startDate, -1) });
    }

    cursor = shiftDateByDays(range.endDate, 1);

    if (cursor > required.endDate) {
      break;
    }
  }

  if (cursor <= required.endDate) {
    gaps.push({ startDate: cursor, endDate: required.endDate });
  }

  return gaps;
}
