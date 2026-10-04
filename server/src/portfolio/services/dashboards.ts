import { arrays } from '@kamaalio/kamaal';

import { aggregateHoldings, getHoldingAmountDelta } from './aggregate-holdings.ts';
import { getCurrentStockValues } from './current-stock-values.ts';
import { resolveHistoricalStockPrices } from './historical-stock-prices.ts';
import type { ResolvedPortfolioEntry } from './resolve-splits.ts';
import { findResolvedPortfolioEntriesByUserId } from './resolved-portfolio-entries.ts';
import type { HonoContext } from '../../api/contexts.ts';
import { getSessionWhereSessionIsRequired } from '../../auth/index.ts';
import { RESOLVED_TRANSACTION_TYPES } from '../../constants/common.ts';
import type { Currency } from '../../forex/constants.ts';
import { withRequestLogger } from '../../logging/http.ts';
import { logWarn } from '../../logging/index.ts';
import { shiftDateByDays } from '../../utils/dates.ts';
import { assertToFloat } from '../../utils/numbers.ts';
import {
  DATE_FORMAT,
  MAX_PORTFOLIO_DASHBOARD_GROWTH_POINTS,
  YAHOO_CHART_LOOKBACK_DAYS,
  YAHOO_CHART_LOOKAHEAD_DAYS,
} from '../constants.ts';
import { ExchangeRateResolutionFailed, StockPriceFetchFailed } from '../exceptions.ts';
import {
  findLatestExchangeRateSnapshotByBase,
  type PersistedExchangeRateSnapshot,
} from '../repositories/list-entries.ts';
import { findStockPricesByTickerIdsBetweenDates, type PersistedStockPrice } from '../repositories/stock-prices.ts';
import type { PortfolioDashboardPeriod } from '../schemas/queries.ts';
import type { PortfolioHoldingDistributionItem } from '../schemas/responses.ts';

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
  portfolioHoldingsDistribution: {
    currency: Currency;
    holdings: PortfolioHoldingDistributionItem[];
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

type CalendarDateShift = { months: number } | { years: number };

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
      portfolioHoldingsDistribution: {
        currency: preferredCurrency,
        holdings: [],
      },
    };
  }

  const currentDate = new Date().toISOString().slice(0, DATE_FORMAT.length);
  const periodStartDate = getPeriodStartDate(options.period, currentDate);

  const snapshotDates = getSnapshotDatesForPeriod(entries, periodStartDate, currentDate);

  const snapshotHoldingsByDate = getSnapshotHoldingsByDate(entries, snapshotDates);

  const historicalPriceRequests = snapshotDates.flatMap(date => {
    return snapshotHoldingsByDate.get(date)?.map(holding => ({ ...holding, date })) ?? [];
  });

  const [[historicalPrices, exchangeRateSnapshot], { currentPoint, distribution }] = await Promise.all([
    resolveHistoricalPricesAndExchangeRateSnapshots(c, { snapshotHoldingsByDate, historicalPriceRequests }),
    makeCurrentPointAndDistribution(c, entries, currentDate),
  ]);

  const priceIndex = indexPrices(historicalPrices);

  const { omittedSnapshotDates, points } = snapshotDates.reduce<{
    omittedSnapshotDates: string[];
    points: { date: string; value: number; is_current: boolean }[];
  }>(
    (acc, date) => {
      const prices =
        snapshotHoldingsByDate.get(date)?.map(holding => ({
          holding,
          price: getClosestPriceForTicker(priceIndex, holding.tickerId, date) ?? holding.fallbackPrice,
        })) ?? [];

      if (prices.some(({ price }) => price == null)) {
        acc.omittedSnapshotDates.push(date);

        return acc;
      }

      const value = prices.reduce((total, { holding, price }) => {
        if (price == null) {
          throw new StockPriceFetchFailed(c);
        }

        return (
          total + holding.amount * convertPriceToPreferredCurrency(c, price, preferredCurrency, exchangeRateSnapshot)
        );
      }, 0);

      acc.points.push({ date, value, is_current: false });

      return acc;
    },
    { omittedSnapshotDates: [], points: [] },
  );

  logOmittedSnapshotDates(c, omittedSnapshotDates);

  const sampledDates = new Set(
    downsampleSnapshotDates(
      points.map(point => point.date),
      MAX_PORTFOLIO_DASHBOARD_GROWTH_POINTS - 1,
    ),
  );

  return {
    portfolioGrowthOverTime: {
      currency: preferredCurrency,
      points: mergeCurrentPoint(
        points.filter(point => sampledDates.has(point.date)),
        currentPoint,
      ),
    },
    portfolioHoldingsDistribution: {
      currency: preferredCurrency,
      holdings: distribution,
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
  const currentDate = new Date().toISOString().slice(0, DATE_FORMAT.length);
  const yesterday = shiftDateByDays(currentDate, -1);

  const ranges = timelines
    .map(timeline => ({
      tickerId: timeline.tickerId,
      stockSymbol: timeline.stockSymbol,
      startDate: shiftDateByDays(timeline.earliestDate, -YAHOO_CHART_LOOKBACK_DAYS),
      endDate: [shiftDateByDays(timeline.latestDate, YAHOO_CHART_LOOKAHEAD_DAYS), yesterday].toSorted()[0],
    }))
    .filter(range => range.startDate <= range.endDate);

  await resolveHistoricalStockPrices(c, ranges);
  const earliestDate = ranges.map(range => range.startDate).toSorted()[0];

  const latestDate = timelines
    .map(timeline => shiftDateByDays(timeline.latestDate, YAHOO_CHART_LOOKAHEAD_DAYS))
    .toSorted()
    .at(-1);

  if (earliestDate == null || latestDate == null) {
    return [];
  }

  const prices = await findStockPricesByTickerIdsBetweenDates(
    c,
    ranges.map(range => range.tickerId),
    earliestDate,
    [latestDate, currentDate].toSorted()[0],
  );

  logUnresolvedHistoricalPriceTimelines(c, getUnresolvedHistoricalPriceRequests(timelines, indexPrices(prices)));

  return prices;
}

async function makeCurrentPointAndDistribution(
  c: HonoContext,
  entries: ResolvedPortfolioEntry[],
  currentDate: string,
): Promise<{ currentPoint: PortfolioGrowthPoint; distribution: PortfolioHoldingDistributionItem[] }> {
  const currentValues = await getCurrentStockValues(c, entries);

  const distribution = arrays.compactMap(aggregateHoldings(entries), holding => {
    if (holding.amount === 0) {
      return null;
    }

    const currentValue = currentValues[holding.entry.stockSymbol];

    if (currentValue == null) {
      throw new StockPriceFetchFailed(c);
    }

    return {
      asset: { symbol: holding.entry.stockSymbol, name: holding.entry.stockName },
      market_value: { currency: currentValue.currency, value: holding.amount * currentValue.value },
    };
  });

  const value = distribution.reduce((total, item) => total + item.market_value.value, 0);

  return {
    currentPoint: { date: currentDate, value, is_current: true },
    distribution,
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

function getSnapshotHoldingsByDate(entries: ResolvedPortfolioEntry[], dates: string[]) {
  const holdings = new Map<string, SnapshotHolding>();
  const snapshots = new Map<string, SnapshotHolding[]>();
  let entryIndex = 0;

  for (const date of dates) {
    while (entryIndex < entries.length && entries[entryIndex].transactionDate <= date) {
      const entry = entries[entryIndex];
      entryIndex += 1;
      const amount = assertToFloat(entry.amount);
      const amountDelta = getHoldingAmountDelta(entry);
      const existingHolding = holdings.get(entry.tickerId);
      const nextAmount = (existingHolding?.amount ?? 0) + amountDelta;
      holdings.set(entry.tickerId, {
        tickerId: entry.tickerId,
        stockSymbol: entry.stockSymbol,
        amount: nextAmount,
        fallbackPrice:
          entry.transactionType === RESOLVED_TRANSACTION_TYPES.BUY
            ? getUpdatedFallbackPrice(existingHolding, entry, amount, nextAmount)
            : (existingHolding?.fallbackPrice ?? null),
      });
    }

    snapshots.set(
      date,
      holdings
        .values()
        .filter(holding => holding.amount > 0)
        .toArray(),
    );
  }

  return snapshots;
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

function getSnapshotDatesForPeriod(
  entries: ResolvedPortfolioEntry[],
  periodStartDate: string | null,
  currentDate: string,
) {
  const firstDate = entries[0]?.transactionDate;

  if (firstDate == null) {
    return [];
  }

  const startDate = periodStartDate != null && periodStartDate > firstDate ? periodStartDate : firstDate;
  const dates: string[] = [];

  for (let date = startDate; date < currentDate; date = shiftDateByDays(date, 1)) {
    dates.push(date);
  }

  return dates;
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
      return shiftDateByDays(currentDate, -7);
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

function indexPrices(prices: PersistedStockPrice[]) {
  const index = prices.reduce((index, price) => {
    const timeline = index.get(price.tickerId) ?? [];
    timeline.push(price);

    return index.set(price.tickerId, timeline);
  }, new Map<string, PersistedStockPrice[]>());

  for (const timeline of index.values()) {
    timeline.sort((a, b) => a.date.localeCompare(b.date));
  }

  return index;
}

function getClosestPriceForTicker(index: Map<string, PersistedStockPrice[]>, tickerId: string, date: string) {
  const timeline = index.get(tickerId) ?? [];
  let lower = 0;
  let upper = timeline.length;

  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);

    if (timeline[middle].date < date) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  return [timeline[lower - 1], timeline[lower]]
    .filter(price => price != null && isPriceWithinHistoricalWindow(price, date))
    .toSorted((left, right) => comparePriceDistance(left, right, date))
    .at(0);
}

function isPriceWithinHistoricalWindow(price: PersistedStockPrice, date: string) {
  const distance = daysBetween(price.date, date);

  return distance >= -YAHOO_CHART_LOOKBACK_DAYS && distance <= YAHOO_CHART_LOOKAHEAD_DAYS;
}

function buildHistoricalPriceTimelines(requests: HistoricalPriceRequest[]): HistoricalPriceTimeline[] {
  const grouped = requests.reduce((grouped, request) => {
    const tickerRequests = grouped.get(request.tickerId) ?? [];
    tickerRequests.push(request);

    return grouped.set(request.tickerId, tickerRequests);
  }, new Map<string, HistoricalPriceRequest[]>());

  return arrays.compactMap(grouped.values().toArray(), tickerRequests => {
    const firstRequest = tickerRequests[0];

    if (tickerRequests.length === 0) {
      return null;
    }

    const dates = new Set(tickerRequests.map(request => request.date)).values().toArray().toSorted();
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

function getUnresolvedHistoricalPriceRequests(
  timelines: HistoricalPriceTimeline[],
  prices: Map<string, PersistedStockPrice[]>,
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

function shiftDateByCalendarParts(date: string, shift: CalendarDateShift) {
  const shiftedDate = new Date(`${date}T00:00:00.000Z`);

  function formatShiftedDate() {
    return shiftedDate.toISOString().slice(0, DATE_FORMAT.length);
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

  shiftMonthAndYear({ months: shift.months, years: 0 });

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
