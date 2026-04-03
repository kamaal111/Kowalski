import { desc, eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { portfolio, portfolioTransaction, stockTicker } from '@/db/schema';

type PortfolioTransactionSelect = typeof portfolioTransaction.$inferSelect;

export interface PersistedPortfolioEntry {
  id: string;
  transactionType: PortfolioTransactionSelect['transactionType'];
  transactionDate: PortfolioTransactionSelect['transactionDate'];
  amount: PortfolioTransactionSelect['amount'];
  purchasePrice: PortfolioTransactionSelect['purchasePrice'];
  purchasePriceCurrency: PortfolioTransactionSelect['purchasePriceCurrency'];
  createdAt: PortfolioTransactionSelect['createdAt'];
  updatedAt: PortfolioTransactionSelect['updatedAt'];
  tickerId: string;
  stockSymbol: string;
  stockIsin: string;
  stockName: string;
  stockSector: string | null;
  stockIndustry: string | null;
  stockExchangeDispatch: string | null;
}

export async function findPortfolioEntriesByUserId(c: HonoContext, userId: string): Promise<PersistedPortfolioEntry[]> {
  return c
    .get('db')
    .select({
      id: portfolioTransaction.id,
      transactionType: portfolioTransaction.transactionType,
      transactionDate: portfolioTransaction.transactionDate,
      amount: portfolioTransaction.amount,
      purchasePrice: portfolioTransaction.purchasePrice,
      purchasePriceCurrency: portfolioTransaction.purchasePriceCurrency,
      createdAt: portfolioTransaction.createdAt,
      updatedAt: portfolioTransaction.updatedAt,
      tickerId: stockTicker.id,
      stockSymbol: stockTicker.symbol,
      stockIsin: stockTicker.isin,
      stockName: stockTicker.name,
      stockSector: stockTicker.sector,
      stockIndustry: stockTicker.industry,
      stockExchangeDispatch: stockTicker.exchangeDispatch,
    })
    .from(portfolioTransaction)
    .innerJoin(portfolio, eq(portfolio.id, portfolioTransaction.portfolioId))
    .innerJoin(stockTicker, eq(stockTicker.id, portfolioTransaction.tickerId))
    .where(eq(portfolio.userId, userId))
    .orderBy(desc(portfolioTransaction.transactionDate), desc(portfolioTransaction.updatedAt));
}
