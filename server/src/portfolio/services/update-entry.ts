import { NotFound } from '@/api/exceptions';
import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import { findPortfolioTransactionByIdAndUserId, updatePortfolioTransaction } from '../repositories/update-entry';
import resolvePortfolioStockTicker from './resolve-stock-ticker';

async function updateEntry(c: HonoContext, entryId: string, payload: CreateEntryPayload) {
  const existingEntry = await findPortfolioTransactionByIdAndUserId(c, entryId);
  if (existingEntry == null) {
    throw new NotFound(c, { message: 'Portfolio entry not found' });
  }

  const stockTicker = await resolvePortfolioStockTicker(c, payload);
  const transaction = await updatePortfolioTransaction(c, {
    id: existingEntry.id,
    transactionType: payload.transaction_type,
    transactionDate: getTransactionDateForStorage(payload.transaction_date),
    amount: payload.amount.toString(),
    purchasePrice: payload.purchase_price.value.toString(),
    purchasePriceCurrency: payload.purchase_price.currency,
    tickerId: stockTicker.id,
  });

  return {
    stock: {
      ...payload.stock,
      isin: stockTicker.isin,
    },
    transaction,
  };
}

function getTransactionDateForStorage(transactionDate: string) {
  return transactionDate.slice(0, 10);
}

export default updateEntry;
