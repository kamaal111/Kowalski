import { arrays } from '@kamaalio/kamaal';

import type { HonoContext } from '@/api/contexts';
import { getSessionWhereSessionIsRequired } from '@/auth';
import { RESOLVED_TRANSACTION_TYPES } from '@/constants/common';
import type { Currency } from '@/forex/constants';
import { logWarn } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { ExchangeRateResolutionFailed, StockPriceFetchFailed } from '../exceptions';
import { assertToFloat } from '@/utils/numbers';
import { findLatestExchangeRateSnapshotByBase, type PersistedExchangeRateSnapshot } from '../repositories/list-entries';
import {
  findStockPricesByTickerIdsBetweenDates,
  insertStockPrices,
  type PersistedStockPrice,
} from '../repositories/stock-prices';
import { aggregateHoldings } from './aggregate-holdings';
import { getCurrentStockValues } from './current-stock-values';
import { findResolvedPortfolioEntriesByUserId } from './resolved-portfolio-entries';
import type { ResolvedPortfolioEntry } from './resolve-splits';
import { fetchYahooChartPrices } from './yahoo-chart';
import { DATE_SHAPE } from '../constants';

const YAHOO_CHART_LOOKBACK_DAYS = 10;
const YAHOO_CHART_LOOKAHEAD_DAYS = 5;

interface PortfolioGrowthPoint {
  date: string;
  value: number;
  is_current: boolean;
}

interface PortfolioDashboardsResult {
  portfolioGrowthOverTime: {
    currency: Currency;
    points: PortfolioGrowthPoint[];
  };
}

interface HistoricalPriceRequest {
  tickerId: string;
  stockSymbol: string;
  date: string;
}

interface HistoricalPriceTimeline {
  tickerId: string;
  stockSymbol: string;
  dates: string[];
  earliestDate: string;
  latestDate: string;
}

interface SnapshotHolding {
  tickerId: string;
  stockSymbol: string;
  amount: number;
}

async function getPortfolioDashboards(c: HonoContext): Promise<PortfolioDashboardsResult> {
  const session = getSessionWhereSessionIsRequired(c);
  const preferredCurrency = session.user.preferred_currency;
  const entries = (await findResolvedPortfolioEntriesByUserId(c)).toSorted(compareEntriesAscending);
  if (entries.length === 0) {
    return {
      portfolioGrowthOverTime: {
        currency: preferredCurrency,
        points: [],
      },
    };
  }

  const snapshotDates = getUniqueTransactionDates(entries);
  const historicalPriceRequests = snapshotDates.flatMap(date => {
    return getSnapshotHoldings(entries, date).map(holding => ({ ...holding, date }));
  });
  const historicalPrices = await resolveHistoricalPrices(c, historicalPriceRequests);
  const [exchangeRateSnapshot, currentPoint] = await Promise.all([
    resolveExchangeRateSnapshotForPrices(c, preferredCurrency, historicalPrices),
    makeCurrentPoint(c, entries),
  ]);
  const { omittedSnapshotDates, points } = snapshotDates.reduce<{
    omittedSnapshotDates: string[];
    points: { date: string; value: number; is_current: boolean }[];
  }>(
    (acc, date) => {
      const prices = getSnapshotHoldings(entries, date).map(holding => ({
        holding,
        price: getClosestPriceForTicker(historicalPrices, holding.tickerId, date),
      }));
      if (prices.some(({ price }) => price == null)) {
        return { ...acc, omittedSnapshotDates: [...acc.omittedSnapshotDates, date] };
      }

      const value = prices.reduce((total, { holding, price }) => {
        if (price == null) {
          throw new StockPriceFetchFailed(c);
        }

        return (
          total + holding.amount * convertPriceToPreferredCurrency(c, price, preferredCurrency, exchangeRateSnapshot)
        );
      }, 0);

      return { ...acc, points: [...acc.points, { date, value, is_current: false }] };
    },
    { omittedSnapshotDates: [], points: [] },
  );

  logOmittedSnapshotDates(c, omittedSnapshotDates);

  return {
    portfolioGrowthOverTime: {
      currency: preferredCurrency,
      points: mergeCurrentPoint(points, currentPoint),
    },
  };
}

async function resolveHistoricalPrices(
  c: HonoContext,
  requests: HistoricalPriceRequest[],
): Promise<PersistedStockPrice[]> {
  const timelines = buildHistoricalPriceTimelines(requests);
  const cachedPrices = await findCachedPrices(c, timelines);
  const missingTimelines = timelines.filter(timeline => {
    return timeline.dates.some(date => getClosestPriceForTicker(cachedPrices, timeline.tickerId, date) == null);
  });
  const fetchedPrices = await fetchAndStoreMissingPrices(c, missingTimelines);
  const resolvedPrices = cachedPrices.concat(fetchedPrices);
  logUnresolvedHistoricalPriceTimelines(c, getUnresolvedHistoricalPriceRequests(timelines, resolvedPrices));

  return resolvedPrices;
}

function findCachedPrices(c: HonoContext, timelines: HistoricalPriceTimeline[]): Promise<PersistedStockPrice[]> {
  const uniqueTickerIds = timelines.map(timeline => timeline.tickerId);
  const earliestDate = timelines.map(timeline => timeline.earliestDate).toSorted()[0];
  const latestDate = timelines
    .map(timeline => timeline.latestDate)
    .toSorted()
    .at(-1);
  if (earliestDate == null || latestDate == null) {
    return Promise.resolve([]);
  }

  return findStockPricesByTickerIdsBetweenDates(
    c,
    uniqueTickerIds,
    shiftDateByDays(earliestDate, -YAHOO_CHART_LOOKBACK_DAYS),
    shiftDateByDays(latestDate, YAHOO_CHART_LOOKAHEAD_DAYS),
  );
}

async function fetchAndStoreMissingPrices(
  c: HonoContext,
  missingTimelines: HistoricalPriceTimeline[],
): Promise<PersistedStockPrice[]> {
  let fetchedPrices: PersistedStockPrice[] = [];
  for (const timeline of missingTimelines) {
    const chartPrices = await fetchYahooChartPrices(c, {
      symbol: timeline.stockSymbol,
      period1: shiftDateByDays(timeline.earliestDate, -YAHOO_CHART_LOOKBACK_DAYS),
      period2: shiftDateByDays(timeline.latestDate, YAHOO_CHART_LOOKAHEAD_DAYS + 1),
    });

    fetchedPrices = fetchedPrices.concat(
      chartPrices.map(price => ({
        tickerId: timeline.tickerId,
        currency: price.currency,
        date: price.date,
        close: price.price,
      })),
    );
  }

  await insertStockPrices(c, fetchedPrices);

  return uniquePrices(fetchedPrices);
}

async function makeCurrentPoint(c: HonoContext, entries: ResolvedPortfolioEntry[]): Promise<PortfolioGrowthPoint> {
  const currentValues = await getCurrentStockValues(c, entries);
  const value = aggregateHoldings(entries).reduce((total, holding) => {
    if (holding.amount === 0) {
      return total;
    }

    const currentValue = currentValues[holding.entry.stockSymbol];
    if (currentValue == null) {
      throw new StockPriceFetchFailed(c);
    }

    return total + holding.amount * currentValue.value;
  }, 0);

  return {
    date: new Date().toISOString().slice(0, DATE_SHAPE.length),
    value,
    is_current: true,
  };
}

async function resolveExchangeRateSnapshotForPrices(
  c: HonoContext,
  preferredCurrency: Currency,
  prices: PersistedStockPrice[],
): Promise<PersistedExchangeRateSnapshot | null> {
  if (prices.every(price => price.currency === preferredCurrency)) {
    return null;
  }

  const snapshot = await findLatestExchangeRateSnapshotByBase(c, preferredCurrency);
  if (snapshot == null) {
    throw new ExchangeRateResolutionFailed(c);
  }

  return snapshot;
}

function convertPriceToPreferredCurrency(
  c: HonoContext,
  price: PersistedStockPrice,
  preferredCurrency: Currency,
  exchangeRateSnapshot: PersistedExchangeRateSnapshot | null,
) {
  if (price.currency === preferredCurrency) {
    return price.close;
  }

  if (exchangeRateSnapshot == null) {
    throw new ExchangeRateResolutionFailed(c);
  }

  const conversionRate = exchangeRateSnapshot.rates[price.currency];
  if (conversionRate == null) {
    throw new ExchangeRateResolutionFailed(c);
  }

  if (!Number.isFinite(conversionRate)) {
    throw new ExchangeRateResolutionFailed(c);
  }

  if (conversionRate <= 0) {
    throw new ExchangeRateResolutionFailed(c);
  }

  return price.close / conversionRate;
}

function getSnapshotHoldings(entries: ResolvedPortfolioEntry[], date: string): SnapshotHolding[] {
  return entries
    .reduce((holdings, entry) => {
      if (entry.transactionDate > date) {
        return holdings;
      }

      const amount = assertToFloat(entry.amount);
      const amountDelta = entry.transactionType === RESOLVED_TRANSACTION_TYPES.BUY ? amount : -amount;
      const existingHolding = holdings.get(entry.tickerId);

      return holdings.set(entry.tickerId, {
        tickerId: entry.tickerId,
        stockSymbol: entry.stockSymbol,
        amount: (existingHolding?.amount ?? 0) + amountDelta,
      });
    }, new Map<string, SnapshotHolding>())
    .values()
    .filter(holding => holding.amount > 0)
    .toArray();
}

function getUniqueTransactionDates(entries: ResolvedPortfolioEntry[]) {
  return [...new Set(entries.map(entry => entry.transactionDate))].toSorted();
}

function mergeCurrentPoint(points: PortfolioGrowthPoint[], currentPoint: PortfolioGrowthPoint): PortfolioGrowthPoint[] {
  const existingPointIndex = points.findIndex(point => point.date === currentPoint.date);
  if (existingPointIndex < 0) {
    return [...points, currentPoint].toSorted(comparePointsAscending);
  }

  return points.map((point, index) => (index === existingPointIndex ? currentPoint : point));
}

function getClosestPriceForTicker(prices: PersistedStockPrice[], tickerId: string, date: string) {
  return prices
    .filter(price => price.tickerId === tickerId && isPriceWithinHistoricalWindow(price, date))
    .toSorted((left, right) => comparePriceDistance(left, right, date))
    .at(0);
}

function isPriceWithinHistoricalWindow(price: PersistedStockPrice, date: string) {
  const distance = daysBetween(price.date, date);

  return distance >= -YAHOO_CHART_LOOKBACK_DAYS && distance <= YAHOO_CHART_LOOKAHEAD_DAYS;
}

function buildHistoricalPriceTimelines(requests: HistoricalPriceRequest[]): HistoricalPriceTimeline[] {
  const grouped = requests.reduce(
    (grouped, request) => grouped.set(request.tickerId, [...(grouped.get(request.tickerId) ?? []), request]),
    new Map<string, HistoricalPriceRequest[]>(),
  );

  return arrays.compactMap(grouped.values().toArray(), tickerRequests => {
    const firstRequest = tickerRequests[0];
    if (tickerRequests.length === 0) {
      return null;
    }

    const dates = [...new Set(tickerRequests.map(request => request.date))].toSorted();
    const earliestDate = dates[0];
    const latestDate = dates.at(-1);
    if (earliestDate == null || latestDate == null) {
      return null;
    }

    return {
      tickerId: firstRequest.tickerId,
      stockSymbol: firstRequest.stockSymbol,
      dates,
      earliestDate,
      latestDate,
    };
  });
}

function uniquePrices(prices: PersistedStockPrice[]) {
  return new Map(prices.map(price => [`${price.tickerId}:${price.date}`, price])).values().toArray();
}

function getUnresolvedHistoricalPriceRequests(
  timelines: HistoricalPriceTimeline[],
  prices: PersistedStockPrice[],
): HistoricalPriceRequest[] {
  return timelines.flatMap(timeline => {
    return timeline.dates.flatMap(date => {
      return getClosestPriceForTicker(prices, timeline.tickerId, date) == null
        ? [{ tickerId: timeline.tickerId, stockSymbol: timeline.stockSymbol, date }]
        : [];
    });
  });
}

function logUnresolvedHistoricalPriceTimelines(c: HonoContext, requests: HistoricalPriceRequest[]) {
  if (requests.length === 0) {
    return;
  }

  logWarn(
    withRequestLogger(c, { component: 'portfolio' }),
    {
      event: 'portfolio.dashboards.historical_prices.unresolved',
      unresolved_request_count: requests.length,
      unresolved_ticker_count: new Set(requests.map(request => request.tickerId)).size,
      first_unresolved_date: requests.map(request => request.date).toSorted()[0],
      last_unresolved_date: requests
        .map(request => request.date)
        .toSorted()
        .at(-1),
      partial: true,
      outcome: 'success',
    },
    'Portfolio dashboard could not resolve every historical close price; affected snapshots will be omitted.',
  );
}

function logOmittedSnapshotDates(c: HonoContext, dates: string[]) {
  if (dates.length === 0) {
    return;
  }

  logWarn(
    withRequestLogger(c, { component: 'portfolio' }),
    {
      event: 'portfolio.dashboards.growth_snapshots_omitted',
      omitted_snapshot_count: dates.length,
      first_omitted_snapshot_date: dates[0],
      last_omitted_snapshot_date: dates.at(-1),
      partial: true,
      outcome: 'success',
    },
    'Portfolio dashboard omitted growth snapshots because historical prices were incomplete.',
  );
}

function shiftDateByDays(date: string, days: number) {
  const shiftedDate = new Date(`${date}T00:00:00.000Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);

  return shiftedDate.toISOString().slice(0, DATE_SHAPE.length);
}

function compareEntriesAscending(left: ResolvedPortfolioEntry, right: ResolvedPortfolioEntry) {
  const dateComparison = left.transactionDate.localeCompare(right.transactionDate);
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return left.updatedAt.getTime() - right.updatedAt.getTime();
}

function comparePointsAscending(left: PortfolioGrowthPoint, right: PortfolioGrowthPoint) {
  return left.date.localeCompare(right.date);
}

function comparePriceDistance(left: PersistedStockPrice, right: PersistedStockPrice, targetDate: string) {
  const leftDistance = Math.abs(daysBetween(left.date, targetDate));
  const rightDistance = Math.abs(daysBetween(right.date, targetDate));
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance;
  }

  const leftIsHistorical = left.date <= targetDate;
  const rightIsHistorical = right.date <= targetDate;
  if (leftIsHistorical !== rightIsHistorical) {
    return leftIsHistorical ? -1 : 1;
  }

  return left.date.localeCompare(right.date);
}

function daysBetween(leftDate: string, rightDate: string) {
  const leftTime = new Date(`${leftDate}T00:00:00.000Z`).getTime();
  const rightTime = new Date(`${rightDate}T00:00:00.000Z`).getTime();

  return (leftTime - rightTime) / 86_400_000;
}

export default getPortfolioDashboards;
