import { eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { portfolio, portfolioTransaction, stockTicker } from '@/db/schema';
import { DefaultPortfolioCreateFailed, PortfolioEntryCreateFailed, StockTickerCreateFailed } from '../exceptions';

type PortfolioInsert = typeof portfolio.$inferInsert;
type PortfolioSelect = typeof portfolio.$inferSelect;
type PortfolioTransactionInsert = typeof portfolioTransaction.$inferInsert;
type PortfolioTransactionSelect = typeof portfolioTransaction.$inferSelect;
type StockTickerInsert = typeof stockTicker.$inferInsert;
type StockTickerSelect = typeof stockTicker.$inferSelect;

type PortfolioRecord = Pick<PortfolioSelect, 'id'>;
type StockTickerRecord = Pick<StockTickerSelect, 'id' | 'name' | 'sector' | 'industry' | 'exchangeDispatch'>;
type CreatePortfolioInput = Pick<PortfolioInsert, 'id' | 'name' | 'userId'>;
type CreateStockTickerInput = Pick<
  StockTickerInsert,
  'id' | 'isin' | 'symbol' | 'name' | 'sector' | 'industry' | 'exchangeDispatch'
>;
type UpdateStockTickerInput = Pick<StockTickerInsert, 'name' | 'sector' | 'industry' | 'exchangeDispatch'>;
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

export async function findDefaultPortfolioByUserId(
  c: HonoContext,
  userId: string,
): Promise<PortfolioRecord | undefined> {
  const portfolios = await c
    .get('db')
    .select({ id: portfolio.id })
    .from(portfolio)
    .where(eq(portfolio.userId, userId))
    .limit(1);

  return portfolios.at(0);
}

export async function createPortfolio(c: HonoContext, input: CreatePortfolioInput): Promise<PortfolioRecord> {
  const createdPortfolios = await c
    .get('db')
    .insert(portfolio)
    .values({ id: input.id, name: input.name, userId: input.userId })
    .returning({ id: portfolio.id });
  const createdPortfolio = createdPortfolios.at(0);
  if (createdPortfolio == null) {
    throw new DefaultPortfolioCreateFailed(c);
  }

  return createdPortfolio;
}

export async function findStockTickerById(c: HonoContext, tickerId: string): Promise<StockTickerRecord | undefined> {
  const tickers = await c
    .get('db')
    .select({
      id: stockTicker.id,
      name: stockTicker.name,
      sector: stockTicker.sector,
      industry: stockTicker.industry,
      exchangeDispatch: stockTicker.exchangeDispatch,
    })
    .from(stockTicker)
    .where(eq(stockTicker.id, tickerId))
    .limit(1);

  return tickers.at(0);
}

export async function updateStockTicker(c: HonoContext, tickerId: string, input: UpdateStockTickerInput) {
  await c.get('db').update(stockTicker).set(input).where(eq(stockTicker.id, tickerId));
}

export async function createStockTicker(c: HonoContext, input: CreateStockTickerInput): Promise<StockTickerRecord> {
  const createdTickers = await c
    .get('db')
    .insert(stockTicker)
    .values({
      id: input.id,
      isin: input.isin,
      symbol: input.symbol,
      name: input.name,
      sector: input.sector,
      industry: input.industry,
      exchangeDispatch: input.exchangeDispatch,
    })
    .returning({
      id: stockTicker.id,
      name: stockTicker.name,
      sector: stockTicker.sector,
      industry: stockTicker.industry,
      exchangeDispatch: stockTicker.exchangeDispatch,
    });
  const createdTicker = createdTickers.at(0);
  if (createdTicker == null) {
    throw new StockTickerCreateFailed(c);
  }

  return createdTicker;
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
