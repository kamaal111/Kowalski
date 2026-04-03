import { getSessionWhereSessionIsRequired } from '@/auth';
import { APP_API_BASE_PATH } from '@/constants/common';
import { STATUS_CODES } from '@/constants/http';
import { toISO8601String } from '@/utils/strings';
import { CreateEntryResponseSchema } from '../schemas/responses';
import createPortfolioEntry from '../services/create-entry';
import { ROUTE_NAME } from '../constants';
import createEntryRoute from '../routes/create-entry';
import { logInfo } from '@/logging';
import { setRequestRoute, setRequestUserId, withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';

const CREATE_ENTRY_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${createEntryRoute.path}` as const;

async function createEntry(c: HonoContext<string, { out: { json: CreateEntryPayload } }>) {
  const session = getSessionWhereSessionIsRequired(c);
  setRequestRoute(c, CREATE_ENTRY_ROUTE_PATH);
  setRequestUserId(c, session.user.id);

  const payload = c.req.valid('json');
  const createdEntry = await createPortfolioEntry(c, session.user.id, payload);

  const response = CreateEntryResponseSchema.parse({
    id: createdEntry.transaction.id,
    stock: createdEntry.stock,
    amount: Number(createdEntry.transaction.amount),
    purchase_price: {
      currency: createdEntry.transaction.purchasePriceCurrency,
      value: Number(createdEntry.transaction.purchasePrice),
    },
    transaction_type: createdEntry.transaction.transactionType,
    transaction_date: getTransactionDateForResponse(createdEntry.transaction.transactionDate),
    created_at: toISO8601String(createdEntry.transaction.createdAt),
    updated_at: toISO8601String(createdEntry.transaction.updatedAt),
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entry.created',
    route: CREATE_ENTRY_ROUTE_PATH,
    user_id: session.user.id,
    ticker_id: createSyntheticTickerId(payload.stock.exchange, payload.stock.symbol),
    ticker_symbol: payload.stock.symbol,
    transaction_type: response.transaction_type,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.CREATED);
}

function getTransactionDateForResponse(transactionDate: string) {
  const [year, month, day] = transactionDate.split('-').map(Number);

  return toISO8601String(new Date(Date.UTC(year, month - 1, day)));
}

function createSyntheticTickerId(exchange: string, symbol: string) {
  return `portfolio-stock:${normalizeTickerPart(exchange)}:${normalizeTickerPart(symbol)}`;
}

function normalizeTickerPart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '-');
}

export default createEntry;
