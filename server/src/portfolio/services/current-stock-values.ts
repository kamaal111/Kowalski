import { getSessionWhereSessionIsRequired } from '@/auth';
import type { HonoContext } from '@/api/contexts';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { PersistedExchangeRateSnapshot } from '../repositories/list-entries';
import { findLatestExchangeRateSnapshotByBase } from '../repositories/list-entries';
import {
  findLatestStockPricesByTickerIds,
  findTodayStockPricesByTickerIds,
  insertStockPrices,
  type PersistedStockPrice,
} from '../repositories/stock-prices';
import { type CurrentValue } from '../schemas/responses';
import { ExchangeRateResolutionFailed, StockPriceFetchFailed } from '../exceptions';
import { fetchYahooQuotes } from './yahoo-quote';

interface EntryWithTickerIdAndStockSymbol {
  tickerId: string;
  stockSymbol: string;
}

export async function getCurrentStockValues(
  c: HonoContext,
  entries: EntryWithTickerIdAndStockSymbol[],
): Promise<Record<string, CurrentValue>> {
  if (entries.length === 0) {
    return {};
  }

  const uniqueEntries = getUniquePortfolioEntries(entries);
  const today = new Date().toISOString().slice(0, 10);
  const todaysStockPrices = await findTodayStockPricesByTickerIds(
    c,
    uniqueEntries.map(entry => entry.tickerId),
    today,
  );
  const resolvedPrices = todaysStockPrices.reduce(
    (acc, storedPrice) => acc.set(storedPrice.tickerId, storedPrice),
    new Map<string, PersistedStockPrice>(),
  );
  const entriesMissingTodayPrice = uniqueEntries.filter(entry => !resolvedPrices.has(entry.tickerId));
  const yahooQuotesBySymbol = await fetchYahooQuotes(
    c,
    entriesMissingTodayPrice.map(entry => entry.stockSymbol),
  );
  const freshPrices = entriesMissingTodayPrice.flatMap(entry => {
    const yahooQuote = yahooQuotesBySymbol.get(entry.stockSymbol);
    if (yahooQuote == null) {
      return [];
    }

    return [
      {
        tickerId: entry.tickerId,
        currency: yahooQuote.currency,
        date: today,
        close: yahooQuote.price,
      },
    ];
  });

  await insertStockPrices(c, freshPrices);

  for (const freshPrice of freshPrices) {
    resolvedPrices.set(freshPrice.tickerId, freshPrice);
  }

  const entriesMissingResolvedPrice = uniqueEntries.filter(entry => !resolvedPrices.has(entry.tickerId));
  const latestStoredPrices = await findLatestStockPricesByTickerIds(
    c,
    entriesMissingResolvedPrice.map(entry => entry.tickerId),
  );
  for (const storedPrice of latestStoredPrices) {
    resolvedPrices.set(storedPrice.tickerId, storedPrice);
  }

  const unresolvedEntries = uniqueEntries.filter(entry => !resolvedPrices.has(entry.tickerId));
  if (unresolvedEntries.length > 0) {
    throw new StockPriceFetchFailed(c);
  }

  const session = getSessionWhereSessionIsRequired(c);
  const preferredCurrency = session.user.preferred_currency;
  const exchangeRateSnapshot = await resolveExchangeRateSnapshotForPreferredCurrency(
    c,
    preferredCurrency,
    resolvedPrices.values(),
  );
  const currentValues = Object.fromEntries(
    uniqueEntries.map(entry => {
      const resolvedPrice = resolvedPrices.get(entry.tickerId);

      if (resolvedPrice == null) {
        throw new StockPriceFetchFailed(c);
      }

      return [
        entry.stockSymbol,
        convertStockPriceToPreferredCurrency({
          c,
          price: resolvedPrice,
          preferredCurrency,
          exchangeRateSnapshot,
        }),
      ];
    }),
  );

  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.stock_prices.resolved',
    result_count: Object.keys(currentValues).length,
    stored_count: freshPrices.length,
    outcome: 'success',
  });

  return currentValues;
}

function getUniquePortfolioEntries<TEntry extends EntryWithTickerIdAndStockSymbol>(entries: TEntry[]) {
  const uniqueEntries = new Map<string, TEntry>();

  for (const entry of entries) {
    if (!uniqueEntries.has(entry.tickerId)) {
      uniqueEntries.set(entry.tickerId, entry);
    }
  }

  return [...uniqueEntries.values()];
}

function convertStockPriceToPreferredCurrency({
  c,
  price,
  preferredCurrency,
  exchangeRateSnapshot,
}: {
  c: HonoContext;
  price: PersistedStockPrice;
  preferredCurrency: string | null;
  exchangeRateSnapshot: PersistedExchangeRateSnapshot | undefined;
}): CurrentValue {
  if (preferredCurrency == null || price.currency === preferredCurrency) {
    return {
      currency: preferredCurrency ?? price.currency,
      value: price.close,
    };
  }

  if (exchangeRateSnapshot == null) {
    throw new ExchangeRateResolutionFailed(c);
  }

  const conversionRate = exchangeRateSnapshot.rates[price.currency];
  if (typeof conversionRate !== 'number' || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    throw new ExchangeRateResolutionFailed(c);
  }

  return {
    currency: preferredCurrency,
    value: price.close / conversionRate,
  };
}

async function resolveExchangeRateSnapshotForPreferredCurrency(
  c: HonoContext,
  preferredCurrency: string | null,
  resolvedPrices: Iterable<PersistedStockPrice>,
) {
  if (preferredCurrency == null) {
    return undefined;
  }

  for (const resolvedPrice of resolvedPrices) {
    if (resolvedPrice.currency === preferredCurrency) {
      continue;
    }

    const exchangeRateSnapshot = await findLatestExchangeRateSnapshotByBase(c, preferredCurrency);
    if (exchangeRateSnapshot == null) {
      throw new ExchangeRateResolutionFailed(c);
    }

    return exchangeRateSnapshot;
  }

  return undefined;
}
