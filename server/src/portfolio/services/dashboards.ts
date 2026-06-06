import { arrays } from '@kamaalio/kamaal';

import type { HonoContext } from '@/api/contexts';
import { getSessionWhereSessionIsRequired } from '@/auth';
import { RESOLVED_TRANSACTION_TYPES } from '@/constants/common';
import type { Currency } from '@/forex/constants';
import { logWarn } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { ExchangeRateResolutionFailed, StockPriceFetchFailed } from '../exceptions';
import { assertToFloat } from '@/utils/numbers';
import type { PortfolioDashboardPeriod } from '../schemas/queries';
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
import { DATE_SHAPE, MAX_PORTFOLIO_DASHBOARD_GROWTH_POINTS } from '../constants';

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
  fallbackPrice: PersistedStockPrice | null;
}

interface PortfolioDashboardsOptions {
  period: PortfolioDashboardPeriod;
}

type CalendarDateShift = { days: number } | { months: number } | { years: number };

async function getPortfolioDashboards(
  c: HonoContext,
  options: PortfolioDashboardsOptions,
): Promise<PortfolioDashboardsResult> {
  const session = getSessionWhereSessionIsRequired(c);
  const preferredCurrency = session.user.preferred_currency;
  const entries = await findResolvedPortfolioEntriesByUserId(c).then(entries => {
    return entries.toSorted(compareEntriesAscending);
  });
  if (entries.length === 0) {
    return {
      portfolioGrowthOverTime: {
        currency: preferredCurrency,
        points: [],
      },
    };
  }

  const currentDate = new Date().toISOString().slice(0, DATE_SHAPE.length);
  const periodStartDate = getPeriodStartDate(options.period, currentDate);
  const snapshotDates = downsampleSnapshotDates(
    getSnapshotDatesForPeriod(entries, periodStartDate),
    MAX_PORTFOLIO_DASHBOARD_GROWTH_POINTS - 1,
  );
  const snapshotHoldingsByDate = getSnapshotHoldingsByDate(entries, snapshotDates);
  const historicalPriceRequests = snapshotDates.flatMap(date => {
    return snapshotHoldingsByDate.get(date)?.map(holding => ({ ...holding, date })) ?? [];
  });
  const [[historicalPrices, exchangeRateSnapshot], currentPoint] = await Promise.all([
    resolveHistoricalPricesAndExchangeRateSnapshots(c, { snapshotHoldingsByDate, historicalPriceRequests }),
    makeCurrentPoint(c, entries, currentDate),
  ]);
  const { omittedSnapshotDates, points } = snapshotDates.reduce<{
    omittedSnapshotDates: string[];
    points: { date: string; value: number; is_current: boolean }[];
  }>(
    (acc, date) => {
      const prices =
        snapshotHoldingsByDate.get(date)?.map(holding => ({
          holding,
          price: getClosestPriceForTicker(historicalPrices, holding.tickerId, date) ?? holding.fallbackPrice,
        })) ?? [];
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

async function resolveHistoricalPricesAndExchangeRateSnapshots(
  c: HonoContext,
  options: {
    snapshotHoldingsByDate: Map<string, SnapshotHolding[]>;
    historicalPriceRequests: HistoricalPriceRequest[];
  },
) {
  const session = getSessionWhereSessionIsRequired(c);
  const preferredCurrency = session.user.preferred_currency;
  const fallbackPrices = options.snapshotHoldingsByDate
    .values()
    .toArray()
    .flatMap(holdings => arrays.compactMap(holdings, holding => holding.fallbackPrice));
  const historicalPrices = await resolveHistoricalPrices(c, options.historicalPriceRequests);

  const exchangeRateSnapshot = await resolveExchangeRateSnapshotForPrices(
    c,
    preferredCurrency,
    historicalPrices.concat(fallbackPrices),
  );

  return [historicalPrices, exchangeRateSnapshot] as const;
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

async function makeCurrentPoint(
  c: HonoContext,
  entries: ResolvedPortfolioEntry[],
  currentDate: string,
): Promise<PortfolioGrowthPoint> {
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
    date: currentDate,
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
      const existingAmount = existingHolding?.amount ?? 0;
      const nextAmount = existingAmount + amountDelta;

      return holdings.set(entry.tickerId, {
        tickerId: entry.tickerId,
        stockSymbol: entry.stockSymbol,
        amount: nextAmount,
        fallbackPrice:
          entry.transactionType === RESOLVED_TRANSACTION_TYPES.BUY
            ? getUpdatedFallbackPrice(existingHolding, entry, amount, nextAmount)
            : (existingHolding?.fallbackPrice ?? null),
      });
    }, new Map<string, SnapshotHolding>())
    .values()
    .filter(holding => holding.amount > 0)
    .toArray();
}

function getSnapshotHoldingsByDate(entries: ResolvedPortfolioEntry[], dates: string[]) {
  return new Map(dates.map(date => [date, getSnapshotHoldings(entries, date)]));
}

function getUpdatedFallbackPrice(
  existingHolding: SnapshotHolding | undefined,
  entry: ResolvedPortfolioEntry,
  amount: number,
  nextAmount: number,
): PersistedStockPrice | null {
  const purchasePrice = assertToFloat(entry.purchasePrice);
  if (existingHolding == null) {
    return {
      tickerId: entry.tickerId,
      currency: entry.purchasePriceCurrency,
      date: entry.transactionDate,
      close: purchasePrice,
    };
  }

  const existingFallbackPrice = existingHolding.fallbackPrice;
  if (existingFallbackPrice == null) {
    return null;
  }
  if (existingFallbackPrice.currency !== entry.purchasePriceCurrency) {
    return null;
  }

  return {
    tickerId: entry.tickerId,
    currency: entry.purchasePriceCurrency,
    date: entry.transactionDate,
    close: (existingFallbackPrice.close * existingHolding.amount + purchasePrice * amount) / nextAmount,
  };
}

function getUniqueTransactionDates(entries: ResolvedPortfolioEntry[]) {
  return new Set(entries.map(entry => entry.transactionDate)).values().toArray().toSorted();
}

function getSnapshotDatesForPeriod(entries: ResolvedPortfolioEntry[], periodStartDate: string | null) {
  const transactionDates = getUniqueTransactionDates(entries).filter(date => {
    return periodStartDate == null || date >= periodStartDate;
  });
  if (periodStartDate == null) {
    return transactionDates;
  }

  const baselineHoldings = getSnapshotHoldings(entries, periodStartDate);
  if (baselineHoldings.length === 0) {
    return transactionDates;
  }

  return new Set([periodStartDate, ...transactionDates]).values().toArray().toSorted();
}

function downsampleSnapshotDates(dates: string[], maxDateCount: number) {
  if (dates.length <= maxDateCount) {
    return dates;
  }
  if (maxDateCount <= 0) {
    return [];
  }
  if (maxDateCount === 1) {
    return [dates[0]];
  }

  const selectedIndexes = new Set<number>();
  for (let index = 0; index < maxDateCount; index += 1) {
    selectedIndexes.add(Math.round((index * (dates.length - 1)) / (maxDateCount - 1)));
  }

  for (let index = dates.length - 1; selectedIndexes.size < maxDateCount && index >= 0; index -= 1) {
    selectedIndexes.add(index);
  }

  return selectedIndexes
    .values()
    .toArray()
    .toSorted((left, right) => left - right)
    .map(index => dates[index])
    .filter(date => date != null);
}

function getPeriodStartDate(period: PortfolioDashboardPeriod, currentDate: string): string | null {
  switch (period) {
    case '1w':
      return shiftDateByCalendarParts(currentDate, { days: -7 });
    case '1m':
      return shiftDateByCalendarParts(currentDate, { months: -1 });
    case '3m':
      return shiftDateByCalendarParts(currentDate, { months: -3 });
    case '6m':
      return shiftDateByCalendarParts(currentDate, { months: -6 });
    case 'ytd':
      return `${currentDate.slice(0, 4)}-01-01`;
    case '1y':
      return shiftDateByCalendarParts(currentDate, { years: -1 });
    case '2y':
      return shiftDateByCalendarParts(currentDate, { years: -2 });
    case '5y':
      return shiftDateByCalendarParts(currentDate, { years: -5 });
    case '10y':
      return shiftDateByCalendarParts(currentDate, { years: -10 });
    case 'all':
      return null;
  }
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
    'Portfolio dashboard could not resolve every historical close price; purchase price fallbacks may be used.',
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

function shiftDateByCalendarParts(date: string, shift: CalendarDateShift) {
  const shiftedDate = new Date(`${date}T00:00:00.000Z`);

  function formatShiftedDate() {
    return shiftedDate.toISOString().slice(0, DATE_SHAPE.length);
  }

  function shiftMonthAndYear(args: { months: number; years: number }) {
    const targetYear = shiftedDate.getUTCFullYear() + args.years;
    const targetMonth = shiftedDate.getUTCMonth() + args.months;
    const targetDay = Math.min(shiftedDate.getUTCDate(), daysInMonth(targetYear, targetMonth));
    shiftedDate.setUTCFullYear(targetYear, targetMonth, targetDay);
  }

  if ('years' in shift) {
    shiftMonthAndYear({ years: shift.years, months: 0 });
    return formatShiftedDate();
  }
  if ('months' in shift) {
    shiftMonthAndYear({ months: shift.months, years: 0 });
    return formatShiftedDate();
  }

  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + shift.days);

  return formatShiftedDate();
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
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
