import { arrays } from '@kamaalio/kamaal';

import { getSessionWhereSessionIsRequired } from '@/auth';
import { ASSET_TYPES, RESOLVED_TRANSACTION_TYPES } from '@/constants/common';
import type { HonoContext } from '@/api/contexts';
import { assertToFloat } from '@/utils/numbers';
import { parseSyntheticTickerId } from '@/utils/tickers';
import { FINAL_FALLBACK_CURRENCY } from '../constants';
import { InvalidTickerId, StockPriceFetchFailed } from '../exceptions';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import type { PortfolioHolding } from '../schemas/responses';
import { getCurrentStockValues } from './current-stock-values';
import { resolveSplits, type ResolvedPortfolioEntry } from './resolve-splits';

interface PortfolioHoldingsResult {
  netWorth: { currency: string; value: number };
  holdings: PortfolioHolding[];
}

interface HoldingAccumulator {
  entry: ResolvedPortfolioEntry;
  amount: number;
}

async function getPortfolioHoldings(c: HonoContext): Promise<PortfolioHoldingsResult> {
  const portfolioEntries = await findPortfolioEntriesByUserId(c);
  const entries = resolveSplits(portfolioEntries);
  const preferredCurrency = getSessionWhereSessionIsRequired(c).user.preferred_currency;
  if (entries.length === 0) {
    return {
      netWorth: { currency: preferredCurrency ?? FINAL_FALLBACK_CURRENCY, value: 0 },
      holdings: [],
    };
  }

  const currentValues = await getCurrentStockValues(c, entries);
  const holdings = arrays
    .compactMap(aggregateHoldings(entries), holding => {
      const mappedHolding = mapHoldingToResponse(c, holding, currentValues);
      if (mappedHolding.amount === 0) {
        return null;
      }

      return mappedHolding;
    })
    .toSorted(compareHoldings);
  const netWorthCurrency =
    holdings[0]?.total_value.currency ??
    Object.values(currentValues)[0]?.currency ??
    preferredCurrency ??
    FINAL_FALLBACK_CURRENCY;
  const netWorthValue = holdings.reduce((total, holding) => total + holding.total_value.value, 0);

  return { netWorth: { currency: netWorthCurrency, value: netWorthValue }, holdings };
}

function aggregateHoldings(entries: ResolvedPortfolioEntry[]): HoldingAccumulator[] {
  return entries
    .reduce((holdingsByTickerId, entry) => {
      const existingHolding = holdingsByTickerId.get(entry.tickerId);
      const amountDelta = getHoldingAmountDelta(entry);
      if (existingHolding == null) {
        return holdingsByTickerId.set(entry.tickerId, { entry, amount: amountDelta });
      }

      existingHolding.amount += amountDelta;

      return holdingsByTickerId.set(entry.tickerId, existingHolding);
    }, new Map<string, HoldingAccumulator>())
    .values()
    .toArray();
}

function getHoldingAmountDelta(entry: ResolvedPortfolioEntry) {
  const amount = assertToFloat(entry.amount);
  switch (entry.transactionType) {
    case RESOLVED_TRANSACTION_TYPES.BUY:
      return amount;
    case RESOLVED_TRANSACTION_TYPES.SELL:
      return -amount;
  }
}

function mapHoldingToResponse(
  c: HonoContext,
  holding: HoldingAccumulator,
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

export default getPortfolioHoldings;
