import crypto from 'node:crypto';

import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import {
  createPortfolio,
  createPortfolioTransaction,
  findDefaultPortfolioByUserId,
} from '../repositories/create-entry';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import resolvePortfolioStockTicker from './resolve-stock-ticker';
import { getSessionWhereSessionIsRequired } from '@/auth';

const DEFAULT_PORTFOLIO_NAME = 'Default Portfolio';

async function createEntry(c: HonoContext, payload: CreateEntryPayload) {
  const [defaultPortfolio, stockTicker] = await Promise.all([
    getOrCreateDefaultPortfolio(c),
    resolvePortfolioStockTicker(c, payload),
  ]);
  const transaction = await createPortfolioTransaction(c, {
    id: crypto.randomUUID(),
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

async function getOrCreateDefaultPortfolio(c: HonoContext) {
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

function getTransactionDateForStorage(transactionDate: string) {
  return transactionDate.slice(0, 10);
}

export default createEntry;
