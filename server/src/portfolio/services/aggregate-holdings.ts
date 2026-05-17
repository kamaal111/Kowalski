import { RESOLVED_TRANSACTION_TYPES } from '@/constants/common';
import { assertToFloat } from '@/utils/numbers';
import type { ResolvedPortfolioEntry } from './resolve-splits';

export interface AggregatedHolding {
  entry: ResolvedPortfolioEntry;
  amount: number;
}

export function aggregateHoldings(entries: ResolvedPortfolioEntry[]): AggregatedHolding[] {
  return entries
    .reduce((holdingsByTickerId, entry) => {
      const existingHolding = holdingsByTickerId.get(entry.tickerId);
      const amountDelta = getHoldingAmountDelta(entry);
      if (existingHolding == null) {
        return holdingsByTickerId.set(entry.tickerId, { entry, amount: amountDelta });
      }

      existingHolding.amount += amountDelta;

      return holdingsByTickerId.set(entry.tickerId, existingHolding);
    }, new Map<string, AggregatedHolding>())
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
