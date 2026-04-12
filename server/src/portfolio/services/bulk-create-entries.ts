import crypto from 'node:crypto';

import { arrays } from '@kamaalio/kamaal';

import type { HonoContext } from '@/api/contexts';
import { PortfolioEntryCreateFailed } from '../exceptions';
import { createPortfolioTransactions, findPortfolioTransactionsByIds } from '../repositories/create-entry';
import type { BulkCreateEntriesPayload, BulkCreateEntryItemPayload } from '../schemas/payloads';
import { getOrCreateDefaultPortfolio, getTransactionDateForStorage } from './create-entry';
import { resolvePortfolioStockTickers } from './resolve-stock-ticker';

type CreatedPortfolioTransaction = Awaited<ReturnType<typeof createPortfolioTransactions>>[number];
type CreatePortfolioTransactionInput = Parameters<typeof createPortfolioTransactions>[1][number];

interface CreatedBulkEntry {
  stock: BulkCreateEntryItemPayload['stock'];
  transaction: CreatedPortfolioTransaction;
}

interface BulkCreateEntriesResult {
  createdEntries: CreatedBulkEntry[];
  skippedCount: number;
}

async function bulkCreateEntries(c: HonoContext, payload: BulkCreateEntriesPayload): Promise<BulkCreateEntriesResult> {
  if (payload.entries.length === 0) {
    return { createdEntries: [], skippedCount: 0 };
  }

  const defaultPortfolio = await getOrCreateDefaultPortfolio(c);
  const existingTransactions = await findPortfolioTransactionsByIds(
    c,
    defaultPortfolio,
    arrays.compactMap(payload.entries, entry => entry.id),
  );
  const existingIds = new Set(existingTransactions.map(transaction => transaction.id));
  const requestedEntriesToCreate: BulkCreateEntryItemPayload[] = [];
  let skippedCount = 0;

  for (const entry of payload.entries) {
    if (entry.id != null && existingIds.has(entry.id)) {
      skippedCount += 1;
      continue;
    }

    requestedEntriesToCreate.push(entry);

    if (entry.id != null) {
      existingIds.add(entry.id);
    }
  }

  if (requestedEntriesToCreate.length === 0) {
    return { createdEntries: [], skippedCount };
  }

  const stockTickers = await resolvePortfolioStockTickers(c, requestedEntriesToCreate);
  const entriesToCreate = requestedEntriesToCreate
    .entries()
    .map(([index, entry]) => {
      const entryId = entry.id ?? crypto.randomUUID();
      const stockTicker = stockTickers[index];
      if (stockTicker == null) {
        throw new PortfolioEntryCreateFailed(c);
      }

      return {
        id: entryId,
        stock: {
          ...entry.stock,
          isin: stockTicker.isin,
        },
        transactionInput: {
          id: entryId,
          transactionType: entry.transaction_type,
          transactionDate: getTransactionDateForStorage(entry.transaction_date),
          amount: entry.amount.toString(),
          purchasePrice: entry.purchase_price.value.toString(),
          purchasePriceCurrency: entry.purchase_price.currency,
          tickerId: stockTicker.id,
          portfolioId: defaultPortfolio.id,
        },
      } satisfies {
        id: string;
        stock: CreatedBulkEntry['stock'];
        transactionInput: CreatePortfolioTransactionInput;
      };
    })
    .toArray();
  const createdTransactions = await createPortfolioTransactions(
    c,
    entriesToCreate.map(entry => entry.transactionInput),
  );
  const createdTransactionsById = new Map(createdTransactions.map(transaction => [transaction.id, transaction]));
  const createdEntries = entriesToCreate.map(entry => {
    const transaction = createdTransactionsById.get(entry.id);
    if (transaction == null) {
      throw new PortfolioEntryCreateFailed(c);
    }

    return {
      stock: entry.stock,
      transaction,
    };
  });

  return { createdEntries, skippedCount };
}

export default bulkCreateEntries;
