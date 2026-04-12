import assert from 'node:assert';

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import type { HonoContext } from '@/api/contexts';
import { portfolio, portfolioTransaction, stockTicker } from '@/db/schema';
import { DefaultPortfolioCreateFailed, PortfolioEntryCreateFailed, StockTickerCreateFailed } from '../exceptions';
import { getSessionWhereSessionIsRequired } from '@/auth';

type PortfolioInsert = typeof portfolio.$inferInsert;
type PortfolioSelect = typeof portfolio.$inferSelect;
type PortfolioTransactionInsert = typeof portfolioTransaction.$inferInsert;
type PortfolioTransactionSelect = typeof portfolioTransaction.$inferSelect;
type StockTickerInsert = typeof stockTicker.$inferInsert;
type StockTickerSelect = typeof stockTicker.$inferSelect;

type PortfolioRecord = Pick<PortfolioSelect, 'id' | 'userId'>;
type StockTickerRecord = Pick<StockTickerSelect, 'id' | 'isin' | 'name' | 'sector' | 'industry' | 'exchangeDispatch'>;
type PortfolioTransactionIdRecord = Pick<PortfolioTransactionSelect, 'id'>;
type CreatePortfolioInput = Pick<PortfolioInsert, 'id' | 'name'>;
type CreateStockTickerInput = Pick<
  StockTickerInsert,
  'id' | 'isin' | 'symbol' | 'name' | 'sector' | 'industry' | 'exchangeDispatch'
>;
type UpdateStockTickerInput = Pick<StockTickerInsert, 'isin' | 'name' | 'sector' | 'industry' | 'exchangeDispatch'>;
type CreatePortfolioTransactionInput = Pick<
  PortfolioTransactionInsert,
  | 'id'
  | 'transactionType'
  | 'transactionDate'
  | 'amount'
  | 'purchasePrice'
  | 'purchasePriceCurrency'
  | 'tickerId'
  | 'portfolioId'
>;
type CreatedPortfolioTransaction = Pick<
  PortfolioTransactionSelect,
  | 'id'
  | 'transactionType'
  | 'transactionDate'
  | 'amount'
  | 'purchasePrice'
  | 'purchasePriceCurrency'
  | 'createdAt'
  | 'updatedAt'
>;

const stockTickerRecordSelection = {
  id: stockTicker.id,
  isin: stockTicker.isin,
  name: stockTicker.name,
  sector: stockTicker.sector,
  industry: stockTicker.industry,
  exchangeDispatch: stockTicker.exchangeDispatch,
};

export async function findDefaultPortfolioByUserId(c: HonoContext): Promise<PortfolioRecord | undefined> {
  const session = getSessionWhereSessionIsRequired(c);
  const portfolios = await c
    .get('db')
    .select({ id: portfolio.id, userId: portfolio.userId })
    .from(portfolio)
    .where(eq(portfolio.userId, session.user.id))
    .limit(1);

  return portfolios.at(0);
}

export async function findPortfolioTransactionsByIds(
  c: HonoContext,
  portfolio: PortfolioRecord,
  transactionIds: string[],
): Promise<PortfolioTransactionIdRecord[]> {
  const session = getSessionWhereSessionIsRequired(c);

  assert(portfolio.userId === session.user.id);

  if (transactionIds.length === 0) {
    return [];
  }

  return c
    .get('db')
    .select({ id: portfolioTransaction.id })
    .from(portfolioTransaction)
    .where(and(eq(portfolioTransaction.portfolioId, portfolio.id), inArray(portfolioTransaction.id, transactionIds)));
}

export async function createPortfolio(c: HonoContext, input: CreatePortfolioInput): Promise<PortfolioRecord> {
  const session = getSessionWhereSessionIsRequired(c);
  const createdPortfolios = await c
    .get('db')
    .insert(portfolio)
    .values({ id: input.id, name: input.name, userId: session.user.id })
    .returning({ id: portfolio.id, userId: portfolio.userId });
  const createdPortfolio = createdPortfolios.at(0);
  if (createdPortfolio == null) {
    throw new DefaultPortfolioCreateFailed(c);
  }

  return createdPortfolio;
}

export async function findStockTickerById(c: HonoContext, tickerId: string): Promise<StockTickerRecord | undefined> {
  const tickers = await findStockTickersByIds(c, [tickerId]);

  return tickers.at(0);
}

export async function findStockTickersByIds(c: HonoContext, tickerIds: string[]): Promise<StockTickerRecord[]> {
  if (tickerIds.length === 0) {
    return [];
  }

  return c.get('db').select(stockTickerRecordSelection).from(stockTicker).where(inArray(stockTicker.id, tickerIds));
}

export async function updateStockTicker(c: HonoContext, tickerId: string, input: UpdateStockTickerInput) {
  await c.get('db').update(stockTicker).set(input).where(eq(stockTicker.id, tickerId));
}

export async function createStockTicker(c: HonoContext, input: CreateStockTickerInput): Promise<StockTickerRecord> {
  const createdTickers = await createStockTickers(c, [input]);
  const createdTicker = createdTickers.at(0);
  if (createdTicker == null) {
    throw new StockTickerCreateFailed(c);
  }

  return createdTicker;
}

export async function createStockTickers(
  c: HonoContext,
  inputs: CreateStockTickerInput[],
): Promise<StockTickerRecord[]> {
  if (inputs.length === 0) {
    return [];
  }

  const createdTickers = await c
    .get('db')
    .insert(stockTicker)
    .values(
      inputs.map(input => ({
        id: input.id,
        isin: input.isin,
        symbol: input.symbol,
        name: input.name,
        sector: input.sector,
        industry: input.industry,
        exchangeDispatch: input.exchangeDispatch,
      })),
    )
    .returning(stockTickerRecordSelection);
  if (createdTickers.length !== inputs.length) {
    throw new StockTickerCreateFailed(c);
  }

  return createdTickers;
}

export async function upsertStockTickers(
  c: HonoContext,
  inputs: CreateStockTickerInput[],
): Promise<StockTickerRecord[]> {
  if (inputs.length === 0) {
    return [];
  }

  const upsertedTickers = await c
    .get('db')
    .insert(stockTicker)
    .values(
      inputs.map(input => ({
        id: input.id,
        isin: input.isin,
        symbol: input.symbol,
        name: input.name,
        sector: input.sector,
        industry: input.industry,
        exchangeDispatch: input.exchangeDispatch,
      })),
    )
    .onConflictDoUpdate({
      target: stockTicker.id,
      set: {
        isin: getExcludedColumn(stockTicker.isin),
        name: getExcludedColumn(stockTicker.name),
        sector: getExcludedColumn(stockTicker.sector),
        industry: getExcludedColumn(stockTicker.industry),
        exchangeDispatch: getExcludedColumn(stockTicker.exchangeDispatch),
      },
    })
    .returning(stockTickerRecordSelection);
  if (upsertedTickers.length !== inputs.length) {
    throw new StockTickerCreateFailed(c);
  }

  return upsertedTickers;
}

function getExcludedColumn(column: AnyPgColumn) {
  return sql.join([sql.identifier('excluded'), sql.identifier(column.name)], sql.raw('.'));
}

export async function createPortfolioTransaction(
  c: HonoContext,
  input: CreatePortfolioTransactionInput,
): Promise<CreatedPortfolioTransaction> {
  const createdTransactions = await c
    .get('db')
    .insert(portfolioTransaction)
    .values({
      id: input.id,
      transactionType: input.transactionType,
      transactionDate: input.transactionDate,
      amount: input.amount,
      purchasePrice: input.purchasePrice,
      purchasePriceCurrency: input.purchasePriceCurrency,
      tickerId: input.tickerId,
      portfolioId: input.portfolioId,
    })
    .returning({
      id: portfolioTransaction.id,
      transactionType: portfolioTransaction.transactionType,
      transactionDate: portfolioTransaction.transactionDate,
      amount: portfolioTransaction.amount,
      purchasePrice: portfolioTransaction.purchasePrice,
      purchasePriceCurrency: portfolioTransaction.purchasePriceCurrency,
      createdAt: portfolioTransaction.createdAt,
      updatedAt: portfolioTransaction.updatedAt,
    });
  const createdTransaction = createdTransactions.at(0);
  if (createdTransaction == null) {
    throw new PortfolioEntryCreateFailed(c);
  }

  return createdTransaction;
}

export async function createPortfolioTransactions(
  c: HonoContext,
  inputs: CreatePortfolioTransactionInput[],
): Promise<CreatedPortfolioTransaction[]> {
  if (inputs.length === 0) {
    return [];
  }

  const createdTransactions = await c
    .get('db')
    .insert(portfolioTransaction)
    .values(
      inputs.map(input => ({
        id: input.id,
        transactionType: input.transactionType,
        transactionDate: input.transactionDate,
        amount: input.amount,
        purchasePrice: input.purchasePrice,
        purchasePriceCurrency: input.purchasePriceCurrency,
        tickerId: input.tickerId,
        portfolioId: input.portfolioId,
      })),
    )
    .returning({
      id: portfolioTransaction.id,
      transactionType: portfolioTransaction.transactionType,
      transactionDate: portfolioTransaction.transactionDate,
      amount: portfolioTransaction.amount,
      purchasePrice: portfolioTransaction.purchasePrice,
      purchasePriceCurrency: portfolioTransaction.purchasePriceCurrency,
      createdAt: portfolioTransaction.createdAt,
      updatedAt: portfolioTransaction.updatedAt,
    });

  if (createdTransactions.length !== inputs.length) {
    throw new PortfolioEntryCreateFailed(c);
  }

  return createdTransactions;
}
