import type { HonoContext } from '@/api/contexts';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import { addPreferredCurrencyPurchasePrices } from './preferred-currency-purchase-price';
import { getCurrentStockValues } from './current-stock-values';
import { resolveSplits } from './resolve-splits';

async function getPortfolioOverview(c: HonoContext) {
  const portfolioEntries = await findPortfolioEntriesByUserId(c);
  const entries = resolveSplits(portfolioEntries);
  const [transactions, currentValues] = await Promise.all([
    addPreferredCurrencyPurchasePrices(c, entries),
    getCurrentStockValues(c, entries),
  ]);

  return { transactions, currentValues };
}

export default getPortfolioOverview;
