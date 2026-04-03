import { getSessionWhereSessionIsRequired } from '@/auth';
import { APP_API_BASE_PATH } from '@/constants/common';
import { STATUS_CODES } from '@/constants/http';
import { dateOnlyStringToISO8601String } from '@/utils/dates';
import { toISO8601String } from '@/utils/strings';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import { ListEntriesResponseSchema } from '../schemas/responses';
import { ROUTE_NAME } from '../constants';
import listEntriesRoute from '../routes/list-entries';
import { logInfo } from '@/logging';
import { setRequestRoute, setRequestUserId, withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import type { PersistedPortfolioEntry } from '../repositories/list-entries';

const LIST_ENTRIES_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${listEntriesRoute.path}` as const;

async function listEntries(c: HonoContext) {
  const session = getSessionWhereSessionIsRequired(c);
  setRequestRoute(c, LIST_ENTRIES_ROUTE_PATH);
  setRequestUserId(c, session.user.id);
  const entries = await findPortfolioEntriesByUserId(c);
  const response = ListEntriesResponseSchema.parse(entries.map(mapPersistedEntryToResponse));
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entries.listed',
    route: LIST_ENTRIES_ROUTE_PATH,
    user_id: session.user.id,
    result_count: response.length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

function mapPersistedEntryToResponse(entry: PersistedPortfolioEntry) {
  return {
    id: entry.id,
    stock: {
      symbol: entry.stockSymbol,
      exchange: getExchangeFromTickerId(entry.tickerId),
      name: entry.stockName,
      isin: entry.stockIsin,
      sector: entry.stockSector,
      industry: entry.stockIndustry,
      exchange_dispatch: entry.stockExchangeDispatch,
    },
    amount: Number(entry.amount),
    purchase_price: {
      currency: entry.purchasePriceCurrency,
      value: Number(entry.purchasePrice),
    },
    transaction_type: entry.transactionType,
    transaction_date: dateOnlyStringToISO8601String(entry.transactionDate),
    created_at: toISO8601String(entry.createdAt),
    updated_at: toISO8601String(entry.updatedAt),
  };
}

function getExchangeFromTickerId(tickerId: string) {
  const [, exchange] = tickerId.split(':');

  return exchange?.length ? exchange : 'UNKNOWN';
}

export default listEntries;
