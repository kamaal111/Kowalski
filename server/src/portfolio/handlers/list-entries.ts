import type { HonoContext } from '@/api/contexts';
import { getSessionWhereSessionIsRequired } from '@/auth';
import { STATUS_CODES } from '@/constants/http';
import { toISO8601String } from '@/utils/strings';
import { findPortfolioEntriesByUserId, type PersistedPortfolioEntry } from '../repositories/list-entries';
import { ListEntriesResponseSchema } from '../schemas/responses';

async function listEntries(c: HonoContext) {
  const session = getSessionWhereSessionIsRequired(c);
  const entries = await findPortfolioEntriesByUserId(c, session.user.id);
  const response = ListEntriesResponseSchema.parse(entries.map(mapPersistedEntryToResponse));

  return c.json(response, STATUS_CODES.OK);
}

function mapPersistedEntryToResponse(entry: PersistedPortfolioEntry) {
  return {
    id: entry.id,
    stock: {
      symbol: entry.stockSymbol,
      exchange: getExchangeFromTickerId(entry.tickerId),
      name: entry.stockName,
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
    transaction_date: getTransactionDateForResponse(entry.transactionDate),
    created_at: toISO8601String(entry.createdAt),
    updated_at: toISO8601String(entry.updatedAt),
  };
}

function getExchangeFromTickerId(tickerId: string) {
  const [, exchange] = tickerId.split(':');

  return exchange?.length ? exchange : 'UNKNOWN';
}

function getTransactionDateForResponse(transactionDate: string) {
  const [year, month, day] = transactionDate.split('-').map(Number);

  return toISO8601String(new Date(Date.UTC(year, month - 1, day)));
}

export default listEntries;
