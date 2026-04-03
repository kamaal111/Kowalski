import crypto from 'node:crypto';

import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import {
  createPortfolio,
  createPortfolioTransaction,
  createStockTicker,
  findDefaultPortfolioByUserId,
  findStockTickerById,
  updateStockTicker,
} from '../repositories/create-entry';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';

const DEFAULT_PORTFOLIO_NAME = 'Default Portfolio';

async function createEntry(c: HonoContext, userId: string, payload: CreateEntryPayload) {
  const [defaultPortfolio, tickerId] = await Promise.all([
    getOrCreateDefaultPortfolio(c, userId),
    getOrCreateStockTicker(c, payload),
  ]);

  return createPortfolioTransaction(c, {
    id: crypto.randomUUID(),
    transactionType: payload.transaction_type,
    transactionDate: getTransactionDateForStorage(payload.transaction_date),
    amount: payload.amount.toString(),
    purchasePrice: payload.purchase_price.value.toString(),
    purchasePriceCurrency: payload.purchase_price.currency,
    tickerId,
    portfolioId: defaultPortfolio.id,
  });
}

async function getOrCreateDefaultPortfolio(c: HonoContext, userId: string) {
  const existingPortfolio = await findDefaultPortfolioByUserId(c, userId);
  if (existingPortfolio != null) {
    return existingPortfolio;
  }

  // TODO: Assert that user id is that which is in the request context
  const createdPortfolio = await createPortfolio(c, {
    id: crypto.randomUUID(),
    name: DEFAULT_PORTFOLIO_NAME,
    userId,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.default_portfolio.created',
    user_id: userId,
    portfolio_id: createdPortfolio.id,
    outcome: 'success',
  });

  return createdPortfolio;
}

async function getOrCreateStockTicker(c: HonoContext, payload: CreateEntryPayload) {
  const tickerId = createSyntheticTickerId(payload);
  const existingTicker = await findStockTickerById(c, tickerId);
  if (existingTicker != null) {
    if (stockTickerNeedsUpdate(existingTicker, payload)) {
      await updateStockTicker(c, existingTicker.id, {
        name: payload.stock.name,
        sector: payload.stock.sector,
        industry: payload.stock.industry,
        exchangeDispatch: payload.stock.exchange_dispatch,
      });
      logInfo(withRequestLogger(c, { component: 'portfolio' }), {
        event: 'portfolio.ticker.updated',
        ticker_id: existingTicker.id,
        ticker_symbol: payload.stock.symbol,
        outcome: 'success',
      });
    }

    return existingTicker.id;
  }

  const createdTicker = await createStockTicker(c, {
    id: tickerId,
    isin: createSyntheticTickerIsin(payload),
    symbol: payload.stock.symbol,
    name: payload.stock.name,
    sector: payload.stock.sector,
    industry: payload.stock.industry,
    exchangeDispatch: payload.stock.exchange_dispatch,
  });

  return createdTicker.id;
}

function stockTickerNeedsUpdate(
  existingTicker: Awaited<ReturnType<typeof findStockTickerById>>,
  payload: CreateEntryPayload,
) {
  if (existingTicker == null) {
    return false;
  }

  return (
    existingTicker.name !== payload.stock.name ||
    existingTicker.sector !== payload.stock.sector ||
    existingTicker.industry !== payload.stock.industry ||
    existingTicker.exchangeDispatch !== payload.stock.exchange_dispatch
  );
}

function createSyntheticTickerId(payload: CreateEntryPayload) {
  return `portfolio-stock:${normalizeTickerPart(payload.stock.exchange)}:${normalizeTickerPart(payload.stock.symbol)}`;
}

function createSyntheticTickerIsin(payload: CreateEntryPayload) {
  return `PORTFOLIO-${normalizeTickerPart(payload.stock.exchange)}-${normalizeTickerPart(payload.stock.symbol)}`;
}

function normalizeTickerPart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '-');
}

function getTransactionDateForStorage(transactionDate: string) {
  return transactionDate.slice(0, 10);
}

export default createEntry;
