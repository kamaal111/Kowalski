import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import { createSyntheticTickerId } from '@/utils/tickers';
import updatePortfolioEntry from '../services/update-entry';
import { addPreferredCurrencyPurchasePrices } from '../services/preferred-currency-purchase-price';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import type { PortfolioEntryPathParams } from '../schemas/params';
import { mapPortfolioEntryToResponse } from '../mappers/entry-response';
import type { CreateEntryResponse } from '../schemas/responses';

async function updateEntry(
  c: HonoContext<string, { out: { json: CreateEntryPayload; param: PortfolioEntryPathParams } }>,
): Promise<TypedResponse<CreateEntryResponse, typeof STATUS_CODES.OK>> {
  const params = c.req.valid('param');
  const payload = c.req.valid('json');
  const updatedEntry = await updatePortfolioEntry(c, params.entryId, payload);
  const [{ preferredCurrencyPurchasePrice }] = await addPreferredCurrencyPurchasePrices(c, [updatedEntry.transaction]);
  const response = mapPortfolioEntryToResponse({
    id: updatedEntry.transaction.id,
    stock: updatedEntry.stock,
    amount: updatedEntry.transaction.amount,
    purchasePrice: updatedEntry.transaction.purchasePrice,
    purchasePriceCurrency: updatedEntry.transaction.purchasePriceCurrency,
    preferredCurrencyPurchasePrice,
    transactionType: updatedEntry.transaction.transactionType,
    transactionDate: updatedEntry.transaction.transactionDate,
    createdAt: updatedEntry.transaction.createdAt,
    updatedAt: updatedEntry.transaction.updatedAt,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entry.updated',
    entry_id: params.entryId,
    ticker_id: createSyntheticTickerId(payload.stock.exchange, payload.stock.symbol),
    ticker_symbol: payload.stock.symbol,
    transaction_type: response.transaction_type,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default updateEntry;
