import type { HonoContext } from '@/api/contexts';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import { addPreferredCurrencyPurchasePrices } from './preferred-currency-purchase-price';
import { getCurrentStockValues } from './current-stock-values';

async function getPortfolioOverview(c: HonoContext) {
  const entries = await findPortfolioEntriesByUserId(c);
  const [transactions, currentValues] = await Promise.all([
    addPreferredCurrencyPurchasePrices(c, entries),
    getCurrentStockValues(c, entries),
  ]);

  return { transactions, currentValues };
}

export default getPortfolioOverview;
