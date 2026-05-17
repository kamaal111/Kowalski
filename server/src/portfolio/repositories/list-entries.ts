import { desc, eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { exchangeRates, portfolio, portfolioTransaction, stockTicker } from '@/db/schema';
import { CurrencyShape, type Currency } from '@/forex/constants';
import { getSessionWhereSessionIsRequired } from '@/auth';

type PortfolioTransactionSelect = typeof portfolioTransaction.$inferSelect;

export interface PersistedPortfolioEntry {
  id: string;
  transactionType: PortfolioTransactionSelect['transactionType'];
  transactionDate: PortfolioTransactionSelect['transactionDate'];
  amount: PortfolioTransactionSelect['amount'];
  purchasePrice: PortfolioTransactionSelect['purchasePrice'];
  purchasePriceCurrency: Currency;
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

export interface PersistedExchangeRateSnapshot {
  base: Currency;
  date: string;
  rates: Partial<Record<Currency, number>>;
}

export async function findPortfolioEntriesByUserId(c: HonoContext): Promise<PersistedPortfolioEntry[]> {
  const session = getSessionWhereSessionIsRequired(c);
  const entries = await c
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
    .where(eq(portfolio.userId, session.user.id))
    .orderBy(desc(portfolioTransaction.transactionDate), desc(portfolioTransaction.updatedAt));

  return entries.map(entry => ({
    ...entry,
    purchasePriceCurrency: CurrencyShape.parse(entry.purchasePriceCurrency),
  }));
}

export async function findLatestExchangeRateSnapshotByBase(
  c: HonoContext,
  base: Currency,
): Promise<PersistedExchangeRateSnapshot | undefined> {
  const latestRates = await c
    .get('db')
    .select({ base: exchangeRates.base, date: exchangeRates.date, rates: exchangeRates.rates })
    .from(exchangeRates)
    .where(eq(exchangeRates.base, base))
    .orderBy(desc(exchangeRates.date))
    .limit(1);
  const latestRate = latestRates.at(0);
  if (latestRate == null) {
    return undefined;
  }

  return {
    date: latestRate.date,
    base: CurrencyShape.parse(latestRate.base),
    rates: Object.fromEntries(
      Object.entries(latestRate.rates).map(([currency, value]) => [CurrencyShape.parse(currency), value]),
    ),
  };
}
