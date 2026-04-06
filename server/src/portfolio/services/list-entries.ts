import type { HonoContext } from '@/api/contexts';
import { findPortfolioEntriesByUserId, type PersistedPortfolioEntry } from '../repositories/list-entries';
import {
  addPreferredCurrencyPurchasePrices,
  type EntryWithPreferredCurrencyPurchasePrice,
} from './preferred-currency-purchase-price';

async function listEntries(
  c: HonoContext,
): Promise<EntryWithPreferredCurrencyPurchasePrice<PersistedPortfolioEntry>[]> {
  const entries = await findPortfolioEntriesByUserId(c);

  return addPreferredCurrencyPurchasePrices(c, entries);
}

export default listEntries;
