import { getSessionWhereSessionIsRequired } from '@/auth';
import { APP_API_BASE_PATH } from '@/constants/common';
import { STATUS_CODES } from '@/constants/http';
import { dateOnlyStringToISO8601String } from '@/utils/dates';
import { toISO8601String } from '@/utils/strings';
import { createSyntheticTickerId } from '@/utils/tickers';
import { CreateEntryResponseSchema } from '../schemas/responses';
import updatePortfolioEntry from '../services/update-entry';
import { ROUTE_NAME } from '../constants';
import updateEntryRoute from '../routes/update-entry';
import { logInfo } from '@/logging';
import { setRequestRoute, setRequestUserId, withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import type { PortfolioEntryPathParams } from '../schemas/params';

const UPDATE_ENTRY_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${updateEntryRoute.path}` as const;

async function updateEntry(
  c: HonoContext<string, { out: { json: CreateEntryPayload; param: PortfolioEntryPathParams } }>,
) {
  const session = getSessionWhereSessionIsRequired(c);
  setRequestRoute(c, UPDATE_ENTRY_ROUTE_PATH);
  setRequestUserId(c, session.user.id);

  const params = c.req.valid('param');
  const payload = c.req.valid('json');
  const updatedEntry = await updatePortfolioEntry(c, params.entryId, payload);

  const response = CreateEntryResponseSchema.parse({
    id: updatedEntry.transaction.id,
    stock: updatedEntry.stock,
    amount: Number(updatedEntry.transaction.amount),
    purchase_price: {
      currency: updatedEntry.transaction.purchasePriceCurrency,
      value: Number(updatedEntry.transaction.purchasePrice),
    },
    transaction_type: updatedEntry.transaction.transactionType,
    transaction_date: dateOnlyStringToISO8601String(updatedEntry.transaction.transactionDate),
    created_at: toISO8601String(updatedEntry.transaction.createdAt),
    updated_at: toISO8601String(updatedEntry.transaction.updatedAt),
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entry.updated',
    route: UPDATE_ENTRY_ROUTE_PATH.replace('{entryId}', params.entryId),
    user_id: session.user.id,
    entry_id: params.entryId,
    ticker_id: createSyntheticTickerId(payload.stock.exchange, payload.stock.symbol),
    ticker_symbol: payload.stock.symbol,
    transaction_type: response.transaction_type,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default updateEntry;
