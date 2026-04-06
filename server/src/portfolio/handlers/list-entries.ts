import { STATUS_CODES } from '@/constants/http';
import listPortfolioEntries from '../services/list-entries';
import type { CreateEntryResponse, ListEntriesResponse } from '../schemas/responses';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import type { PersistedPortfolioEntry } from '../repositories/list-entries';
import { mapPortfolioEntryToResponse } from '../mappers/entry-response';

async function listEntries(c: HonoContext) {
  const entries = await listPortfolioEntries(c);
  const response = entries.map(mapPersistedEntryToResponse) satisfies ListEntriesResponse;
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entries.listed',
    result_count: response.length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

function mapPersistedEntryToResponse({
  entry,
  preferredCurrencyPurchasePrice,
}: {
  entry: PersistedPortfolioEntry;
  preferredCurrencyPurchasePrice: {
    currency: string;
    value: number;
  } | null;
}): CreateEntryResponse {
  return mapPortfolioEntryToResponse({
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
    amount: entry.amount,
    purchasePrice: entry.purchasePrice,
    purchasePriceCurrency: entry.purchasePriceCurrency,
    preferredCurrencyPurchasePrice,
    transactionType: entry.transactionType,
    transactionDate: entry.transactionDate,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

function getExchangeFromTickerId(tickerId: string) {
  const [, exchange] = tickerId.split(':');

  return exchange?.length ? exchange : 'UNKNOWN';
}

export default listEntries;
