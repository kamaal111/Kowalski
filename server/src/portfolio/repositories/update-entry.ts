import { and, eq } from 'drizzle-orm';

import type { HonoContext } from '@/api/contexts';
import { portfolio, portfolioTransaction } from '@/db/schema';
import { CurrencyShape, type Currency } from '@/forex/constants';
import { PortfolioEntryUpdateFailed } from '../exceptions';
import { getSessionWhereSessionIsRequired } from '@/auth';

type PortfolioTransactionInsert = typeof portfolioTransaction.$inferInsert;
type PortfolioTransactionSelect = typeof portfolioTransaction.$inferSelect;

type OwnedPortfolioTransaction = Pick<
  PortfolioTransactionSelect,
  'id' | 'transactionType' | 'transactionDate' | 'amount' | 'purchasePrice' | 'tickerId' | 'createdAt' | 'updatedAt'
> & { purchasePriceCurrency: Currency };

type UpdatePortfolioTransactionInput = Pick<
  PortfolioTransactionInsert,
  'id' | 'transactionType' | 'transactionDate' | 'amount' | 'purchasePrice' | 'purchasePriceCurrency' | 'tickerId'
>;

function mapOwnedPortfolioTransaction<TTransaction extends { purchasePriceCurrency: string }>(
  transaction: TTransaction,
): TTransaction & { purchasePriceCurrency: Currency } {
  return {
    ...transaction,
    purchasePriceCurrency: CurrencyShape.parse(transaction.purchasePriceCurrency),
  };
}

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

  const transaction = transactions.at(0);

  return transaction == null ? undefined : mapOwnedPortfolioTransaction(transaction);
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

  return mapOwnedPortfolioTransaction(updatedTransaction);
}
