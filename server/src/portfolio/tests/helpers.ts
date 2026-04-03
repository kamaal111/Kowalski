import { randomUUID } from 'crypto';

import { eq } from 'drizzle-orm';

import type { Database } from '@/db';
import { portfolio, portfolioTransaction, stockTicker } from '@/db/schema';
import { dateOnlyStringToISO8601String } from '@/utils/dates';
import { createSyntheticTickerId, createSyntheticTickerIsin } from '@/utils/tickers';
import { CreateEntryResponseSchema } from '../schemas/responses';

const DEFAULT_PORTFOLIO_NAME = 'Default Portfolio';

interface SeedPortfolioEntryInput {
  userId: string;
  stock: {
    symbol: string;
    exchange: string;
    name: string;
    isin?: string | null;
    sector?: string | null;
    industry?: string | null;
    exchangeDispatch?: string | null;
  };
  amount: number;
  purchasePrice: {
    currency: string;
    value: number;
  };
  transactionType: 'buy' | 'sell' | 'split';
  transactionDate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function seedPortfolioEntry(db: Database, input: SeedPortfolioEntryInput) {
  const defaultPortfolio = await getOrCreateDefaultPortfolio(db, input.userId);
  const ticker = await getOrCreateTicker(db, input.stock);
  const transactionId = randomUUID();
  const createdAt = input.createdAt ?? new Date('2025-12-20T12:00:00.000Z');
  const updatedAt = input.updatedAt ?? createdAt;

  await db.insert(portfolioTransaction).values({
    id: transactionId,
    transactionType: input.transactionType,
    transactionDate: input.transactionDate.slice(0, 10),
    amount: input.amount.toString(),
    purchasePrice: input.purchasePrice.value.toString(),
    purchasePriceCurrency: input.purchasePrice.currency,
    tickerId: ticker.id,
    portfolioId: defaultPortfolio.id,
    createdAt,
    updatedAt,
  });

  return CreateEntryResponseSchema.parse({
    id: transactionId,
    stock: {
      symbol: input.stock.symbol,
      exchange: input.stock.exchange,
      name: input.stock.name,
      isin: input.stock.isin ?? createSyntheticTickerIsin(input.stock.exchange, input.stock.symbol),
      sector: input.stock.sector ?? null,
      industry: input.stock.industry ?? null,
      exchange_dispatch: input.stock.exchangeDispatch ?? null,
    },
    amount: input.amount,
    purchase_price: {
      currency: input.purchasePrice.currency,
      value: input.purchasePrice.value,
    },
    transaction_type: input.transactionType,
    transaction_date: dateOnlyStringToISO8601String(input.transactionDate.slice(0, 10)),
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
  });
}

async function getOrCreateDefaultPortfolio(db: Database, userId: string) {
  const existingPortfolios = await db
    .select({ id: portfolio.id })
    .from(portfolio)
    .where(eq(portfolio.userId, userId))
    .limit(1);
  const existingPortfolio = existingPortfolios.at(0);
  if (existingPortfolio != null) {
    return existingPortfolio;
  }

  const createdPortfolios = await db
    .insert(portfolio)
    .values({
      id: randomUUID(),
      name: DEFAULT_PORTFOLIO_NAME,
      userId,
    })
    .returning({ id: portfolio.id });
  const createdPortfolio = createdPortfolios.at(0);
  if (createdPortfolio == null) {
    throw new Error('Failed to create seeded portfolio');
  }

  return createdPortfolio;
}

async function getOrCreateTicker(db: Database, stock: SeedPortfolioEntryInput['stock']) {
  const tickerId = createSyntheticTickerId(stock.exchange, stock.symbol);
  const existingTickers = await db
    .select({ id: stockTicker.id, isin: stockTicker.isin })
    .from(stockTicker)
    .where(eq(stockTicker.id, tickerId))
    .limit(1);
  const existingTicker = existingTickers.at(0);
  if (existingTicker != null) {
    await db
      .update(stockTicker)
      .set({
        isin: stock.isin ?? existingTicker.isin,
        name: stock.name,
        sector: stock.sector ?? null,
        industry: stock.industry ?? null,
        exchangeDispatch: stock.exchangeDispatch ?? null,
      })
      .where(eq(stockTicker.id, tickerId));
    return existingTicker;
  }

  const createdTickers = await db
    .insert(stockTicker)
    .values({
      id: tickerId,
      isin: stock.isin ?? createSyntheticTickerIsin(stock.exchange, stock.symbol),
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector ?? null,
      industry: stock.industry ?? null,
      exchangeDispatch: stock.exchangeDispatch ?? null,
    })
    .returning({ id: stockTicker.id });
  const createdTicker = createdTickers.at(0);
  if (createdTicker == null) {
    throw new Error('Failed to create seeded ticker');
  }

  return createdTicker;
}
