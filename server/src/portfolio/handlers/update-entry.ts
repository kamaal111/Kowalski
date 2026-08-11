import type { UpdateEntryRouteResponse } from '../routes/update-entry.ts';

import { STATUS_CODES } from '../../constants/http.ts';
import { createSyntheticTickerId } from '../../utils/tickers.ts';
import updatePortfolioEntry from '../services/update-entry.ts';
import { addPreferredCurrencyPurchasePrices } from '../services/preferred-currency-purchase-price.ts';
import { logInfo } from '../../logging/index.ts';
import { withRequestLogger } from '../../logging/http.ts';
import type { HonoContext } from '../../api/contexts.ts';
import type { CreateEntryPayload } from '../schemas/payloads.ts';
import type { PortfolioEntryPathParams } from '../schemas/params.ts';
import { mapPortfolioEntryToResponse } from '../mappers/entry-response.ts';

async function updateEntry(
  c: HonoContext<string, { out: { json: CreateEntryPayload; param: PortfolioEntryPathParams } }>,
): Promise<UpdateEntryRouteResponse> {
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
