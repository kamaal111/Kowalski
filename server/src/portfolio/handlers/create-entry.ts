import { STATUS_CODES } from '@/constants/http';
import { createSyntheticTickerId } from '@/utils/tickers';
import createPortfolioEntry from '../services/create-entry';
import { addPreferredCurrencyPurchasePrices } from '../services/preferred-currency-purchase-price';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import { mapPortfolioEntryToResponse } from '../mappers/entry-response';

async function createEntry(c: HonoContext<string, { out: { json: CreateEntryPayload } }>) {
  const payload = c.req.valid('json');
  const createdEntry = await createPortfolioEntry(c, payload);
  const [{ preferredCurrencyPurchasePrice }] = await addPreferredCurrencyPurchasePrices(c, [createdEntry.transaction]);
  const response = mapPortfolioEntryToResponse({
    id: createdEntry.transaction.id,
    stock: createdEntry.stock,
    amount: createdEntry.transaction.amount,
    purchasePrice: createdEntry.transaction.purchasePrice,
    purchasePriceCurrency: createdEntry.transaction.purchasePriceCurrency,
    preferredCurrencyPurchasePrice,
    transactionType: createdEntry.transaction.transactionType,
    transactionDate: createdEntry.transaction.transactionDate,
    createdAt: createdEntry.transaction.createdAt,
    updatedAt: createdEntry.transaction.updatedAt,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entry.created',
    ticker_id: createSyntheticTickerId(payload.stock.exchange, payload.stock.symbol),
    ticker_symbol: payload.stock.symbol,
    transaction_type: response.transaction_type,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.CREATED);
}

export default createEntry;
