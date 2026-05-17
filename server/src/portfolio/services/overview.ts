import { arrays } from '@kamaalio/kamaal';

import type { HonoContext } from '@/api/contexts';
import { getSessionWhereSessionIsRequired } from '@/auth';
import { ASSET_TYPES } from '@/constants/common';
import { parseSyntheticTickerId } from '@/utils/tickers';
import { FINAL_FALLBACK_CURRENCY } from '../constants';
import { InvalidTickerId, StockPriceFetchFailed } from '../exceptions';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import type { PortfolioHolding } from '../schemas/responses';
import { aggregateHoldings, type AggregatedHolding } from './aggregate-holdings';
import {
  addPreferredCurrencyPurchasePrices,
  type EntryWithPreferredCurrencyPurchasePrice,
} from './preferred-currency-purchase-price';
import { getCurrentStockValues } from './current-stock-values';
import { resolveSplits, type ResolvedPortfolioEntry } from './resolve-splits';

interface PortfolioOverviewResult {
  transactions: EntryWithPreferredCurrencyPurchasePrice<ResolvedPortfolioEntry>[];
  currentValues: Awaited<ReturnType<typeof getCurrentStockValues>>;
  holdings: PortfolioHolding[];
  netWorth: { currency: string; value: number };
}

async function getPortfolioOverview(c: HonoContext): Promise<PortfolioOverviewResult> {
  const portfolioEntries = await findPortfolioEntriesByUserId(c);
  const entries = resolveSplits(portfolioEntries);
  const preferredCurrency = getSessionWhereSessionIsRequired(c).user.preferred_currency;
  if (entries.length === 0) {
    return {
      transactions: [],
      currentValues: {},
      holdings: [],
      netWorth: { currency: preferredCurrency ?? FINAL_FALLBACK_CURRENCY, value: 0 },
    };
  }

  const [transactions, currentValues] = await Promise.all([
    addPreferredCurrencyPurchasePrices(c, entries),
    getCurrentStockValues(c, entries),
  ]);
  const holdings = mapHoldings(c, entries, currentValues);
  const netWorthCurrency =
    holdings[0]?.total_value.currency ??
    Object.values(currentValues)[0]?.currency ??
    preferredCurrency ??
    FINAL_FALLBACK_CURRENCY;
  const netWorthValue = holdings.reduce((total, holding) => total + holding.total_value.value, 0);

  return {
    transactions,
    currentValues,
    holdings,
    netWorth: {
      currency: netWorthCurrency,
      value: netWorthValue,
    },
  };
}

function mapHoldings(
  c: HonoContext,
  entries: ResolvedPortfolioEntry[],
  currentValues: Awaited<ReturnType<typeof getCurrentStockValues>>,
): PortfolioHolding[] {
  return arrays
    .compactMap(aggregateHoldings(entries), holding => {
      const mappedHolding = mapHoldingToResponse(c, holding, currentValues);
      if (mappedHolding.amount === 0) {
        return null;
      }

      return mappedHolding;
    })
    .toSorted(compareHoldings);
}

function mapHoldingToResponse(
  c: HonoContext,
  holding: AggregatedHolding,
  currentValues: Awaited<ReturnType<typeof getCurrentStockValues>>,
): PortfolioHolding {
  const unitValue = currentValues[holding.entry.stockSymbol];
  if (unitValue == null) {
    throw new StockPriceFetchFailed(c);
  }

  const parsedTickerId = parseRequiredSyntheticTickerId(c, holding.entry.tickerId);

  return {
    asset_type: ASSET_TYPES.EQUITY,
    asset: {
      symbol: holding.entry.stockSymbol,
      exchange: parsedTickerId.exchange,
      name: holding.entry.stockName,
      isin: holding.entry.stockIsin,
      sector: holding.entry.stockSector,
      industry: holding.entry.stockIndustry,
      exchange_dispatch: holding.entry.stockExchangeDispatch,
    },
    amount: holding.amount,
    unit_value: unitValue,
    total_value: {
      currency: unitValue.currency,
      value: holding.amount * unitValue.value,
    },
  };
}

function compareHoldings(left: PortfolioHolding, right: PortfolioHolding) {
  const valueComparison = right.total_value.value - left.total_value.value;
  if (valueComparison !== 0) {
    return valueComparison;
  }

  return left.asset.symbol.localeCompare(right.asset.symbol);
}

function parseRequiredSyntheticTickerId(c: HonoContext, tickerId: string) {
  const parsedTickerId = parseSyntheticTickerId(tickerId);
  if (parsedTickerId == null) {
    throw new InvalidTickerId(c, tickerId);
  }

  return parsedTickerId;
}

export default getPortfolioOverview;
