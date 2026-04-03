import { and, eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { portfolio, portfolioTransaction } from '@/db/schema';
import { PortfolioEntryUpdateFailed } from '../exceptions';
import { getSessionWhereSessionIsRequired } from '@/auth';

type PortfolioTransactionInsert = typeof portfolioTransaction.$inferInsert;
type PortfolioTransactionSelect = typeof portfolioTransaction.$inferSelect;

type OwnedPortfolioTransaction = Pick<
  PortfolioTransactionSelect,
  | 'id'
  | 'transactionType'
  | 'transactionDate'
  | 'amount'
  | 'purchasePrice'
  | 'purchasePriceCurrency'
  | 'tickerId'
  | 'createdAt'
  | 'updatedAt'
>;

type UpdatePortfolioTransactionInput = Pick<
  PortfolioTransactionInsert,
  'id' | 'transactionType' | 'transactionDate' | 'amount' | 'purchasePrice' | 'purchasePriceCurrency' | 'tickerId'
>;

export async function findPortfolioTransactionByIdAndUserId(
  c: HonoContext,
  entryId: string,
): Promise<OwnedPortfolioTransaction | undefined> {
  const session = getSessionWhereSessionIsRequired(c);
  const transactions = await c
    .get('db')
    .select({
      id: portfolioTransaction.id,
      transactionType: portfolioTransaction.transactionType,
      transactionDate: portfolioTransaction.transactionDate,
      amount: portfolioTransaction.amount,
      purchasePrice: portfolioTransaction.purchasePrice,
      purchasePriceCurrency: portfolioTransaction.purchasePriceCurrency,
      tickerId: portfolioTransaction.tickerId,
      createdAt: portfolioTransaction.createdAt,
      updatedAt: portfolioTransaction.updatedAt,
    })
    .from(portfolioTransaction)
    .innerJoin(portfolio, eq(portfolio.id, portfolioTransaction.portfolioId))
    .where(and(eq(portfolioTransaction.id, entryId), eq(portfolio.userId, session.user.id)))
    .limit(1);

  return transactions.at(0);
}

export async function updatePortfolioTransaction(
  c: HonoContext,
  input: UpdatePortfolioTransactionInput,
): Promise<OwnedPortfolioTransaction> {
  const updatedTransactions = await c
    .get('db')
    .update(portfolioTransaction)
    .set({
      transactionType: input.transactionType,
      transactionDate: input.transactionDate,
      amount: input.amount,
      purchasePrice: input.purchasePrice,
      purchasePriceCurrency: input.purchasePriceCurrency,
      tickerId: input.tickerId,
    })
    .where(eq(portfolioTransaction.id, input.id))
    .returning({
      id: portfolioTransaction.id,
      transactionType: portfolioTransaction.transactionType,
      transactionDate: portfolioTransaction.transactionDate,
      amount: portfolioTransaction.amount,
      purchasePrice: portfolioTransaction.purchasePrice,
      purchasePriceCurrency: portfolioTransaction.purchasePriceCurrency,
      tickerId: portfolioTransaction.tickerId,
      createdAt: portfolioTransaction.createdAt,
      updatedAt: portfolioTransaction.updatedAt,
    });
  const updatedTransaction = updatedTransactions.at(0);
  if (updatedTransaction == null) {
    throw new PortfolioEntryUpdateFailed(c);
  }

  return updatedTransaction;
}
