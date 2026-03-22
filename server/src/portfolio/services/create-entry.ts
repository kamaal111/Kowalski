import crypto from 'node:crypto';

import type { HonoContext } from '@/api/contexts.js';
import type { CreateEntryPayload } from '../schemas/payloads.js';
import {
  createPortfolio,
  createPortfolioTransaction,
  createStockTicker,
  findDefaultPortfolioByUserId,
  findStockTickerById,
  updateStockTickerName,
} from '../repositories/create-entry.js';

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

  return createPortfolio(c, {
    id: crypto.randomUUID(),
    name: DEFAULT_PORTFOLIO_NAME,
    userId,
  });
}

async function getOrCreateStockTicker(c: HonoContext, payload: CreateEntryPayload) {
  const tickerId = createSyntheticTickerId(payload);
  const existingTicker = await findStockTickerById(c, tickerId);
  if (existingTicker != null) {
    if (existingTicker.name !== payload.stock.name) {
      await updateStockTickerName(c, existingTicker.id, payload.stock.name);
    }

    return existingTicker.id;
  }

  const createdTicker = await createStockTicker(c, {
    id: tickerId,
    isin: createSyntheticTickerIsin(payload),
    symbol: payload.stock.symbol,
    name: payload.stock.name,
  });

  return createdTicker.id;
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
