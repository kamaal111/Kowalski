import type { HonoContext } from '@/api/contexts';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import {
  addPreferredCurrencyPurchasePrices,
  type EntryWithPreferredCurrencyPurchasePrice,
} from './preferred-currency-purchase-price';
import { resolveSplits, type ResolvedPortfolioEntry } from './resolve-splits';

async function listEntries(c: HonoContext): Promise<EntryWithPreferredCurrencyPurchasePrice<ResolvedPortfolioEntry>[]> {
  const portfolioEntries = await findPortfolioEntriesByUserId(c);
  const entries = resolveSplits(portfolioEntries);

  return addPreferredCurrencyPurchasePrices(c, entries);
}

export default listEntries;
