import crypto from 'node:crypto';

import type { HonoContext } from '../../api/contexts.ts';
import type { CreateEntryPayload } from '../schemas/payloads.ts';
import {
  createPortfolio,
  createPortfolioTransaction,
  findDefaultPortfolioByUserId,
} from '../repositories/create-entry.ts';
import { logInfo } from '../../logging/index.ts';
import { withRequestLogger } from '../../logging/http.ts';
import resolvePortfolioStockTicker from './resolve-stock-ticker.ts';
import { getSessionWhereSessionIsRequired } from '../../auth/index.ts';

const DEFAULT_PORTFOLIO_NAME = 'Default Portfolio';

async function createEntry(c: HonoContext, payload: CreateEntryPayload, options: { entryId?: string } = {}) {
  const [defaultPortfolio, stockTicker] = await Promise.all([
    getOrCreateDefaultPortfolio(c),
    resolvePortfolioStockTicker(c, payload),
  ]);
  const transaction = await createPortfolioTransaction(c, {
    id: options.entryId ?? crypto.randomUUID(),
    transactionType: payload.transaction_type,
    transactionDate: getTransactionDateForStorage(payload.transaction_date),
    amount: payload.amount.toString(),
    purchasePrice: payload.purchase_price.value.toString(),
    purchasePriceCurrency: payload.purchase_price.currency,
    tickerId: stockTicker.id,
    portfolioId: defaultPortfolio.id,
  });

  return {
    stock: {
      ...payload.stock,
      isin: stockTicker.isin,
    },
    transaction,
  };
}

export async function getOrCreateDefaultPortfolio(c: HonoContext) {
  const existingPortfolio = await findDefaultPortfolioByUserId(c);
  if (existingPortfolio != null) {
    return existingPortfolio;
  }

  const createdPortfolio = await createPortfolio(c, { id: crypto.randomUUID(), name: DEFAULT_PORTFOLIO_NAME });
  const session = getSessionWhereSessionIsRequired(c);
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.default_portfolio.created',
    user_id: session.user.id,
    portfolio_id: createdPortfolio.id,
    outcome: 'success',
  });

  return createdPortfolio;
}

export function getTransactionDateForStorage(transactionDate: string) {
  return transactionDate.slice(0, 10);
}

export default createEntry;
