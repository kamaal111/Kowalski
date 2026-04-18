import crypto from 'node:crypto';

import { assertToFloat } from '@/utils/numbers';
import type { PersistedPortfolioEntry } from '../repositories/list-entries';
import {
  RESOLVED_TRANSACTION_TYPES,
  TRANSACTION_TYPES,
  type ResolvedtransactionType,
  type TransactionType,
} from '@/constants/common';

export interface ResolvedPortfolioEntry extends Omit<
  PersistedPortfolioEntry,
  'amount' | 'purchasePrice' | 'transactionType'
> {
  amount: PersistedPortfolioEntry['amount'] | number;
  purchasePrice: PersistedPortfolioEntry['purchasePrice'] | number;
  transactionType: ResolvedtransactionType;
}

interface ResolvedPortfolioEntryWithSortMetadata {
  entry: ResolvedPortfolioEntry;
  splitOrderGroup: string;
  splitOrderStep: number;
}

interface SplitsResolverAcc {
  holdingsByTickerId: Map<string, number>;
  resolvedEntries: ResolvedPortfolioEntryWithSortMetadata[];
}

const SPLITS_RESOLVERS_MAP: Record<
  TransactionType,
  (entry: PersistedPortfolioEntry, acc: SplitsResolverAcc) => SplitsResolverAcc
> = {
  [TRANSACTION_TYPES.BUY]: resolveBuyForSplits,
  [TRANSACTION_TYPES.SELL]: resolveSellForSplits,
  [TRANSACTION_TYPES.SPLIT]: resolveSplitForSplits,
};

export function resolveSplits(entries: PersistedPortfolioEntry[]): ResolvedPortfolioEntry[] {
  return entries
    .toSorted(compareEntriesAscending)
    .reduce<SplitsResolverAcc>((acc, entry) => SPLITS_RESOLVERS_MAP[entry.transactionType](entry, acc), {
      holdingsByTickerId: new Map(),
      resolvedEntries: [],
    })
    .resolvedEntries.sort(compareEntriesDescending)
    .map(item => item.entry);
}

function resolveBuyForSplits(entry: PersistedPortfolioEntry, acc: SplitsResolverAcc): SplitsResolverAcc {
  const amount = assertToFloat(entry.amount);
  const currentSharesHeld = acc.holdingsByTickerId.get(entry.tickerId) ?? 0;

  return {
    holdingsByTickerId: acc.holdingsByTickerId.set(entry.tickerId, currentSharesHeld + amount),
    resolvedEntries: [...acc.resolvedEntries, createResolvedEntry({ entry, transactionType: TRANSACTION_TYPES.BUY })],
  };
}

function resolveSellForSplits(entry: PersistedPortfolioEntry, acc: SplitsResolverAcc): SplitsResolverAcc {
  const amount = assertToFloat(entry.amount);
  const currentSharesHeld = acc.holdingsByTickerId.get(entry.tickerId) ?? 0;

  return {
    holdingsByTickerId: acc.holdingsByTickerId.set(entry.tickerId, currentSharesHeld - amount),
    resolvedEntries: [...acc.resolvedEntries, createResolvedEntry({ entry, transactionType: TRANSACTION_TYPES.SELL })],
  };
}

function resolveSplitForSplits(entry: PersistedPortfolioEntry, acc: SplitsResolverAcc): SplitsResolverAcc {
  const splitRatio = assertToFloat(entry.amount);
  const currentSharesHeld = acc.holdingsByTickerId.get(entry.tickerId) ?? 0;
  const postSplitSharesHeld = currentSharesHeld * splitRatio;
  const holdingsByTickerId = acc.holdingsByTickerId.set(entry.tickerId, postSplitSharesHeld);
  if (currentSharesHeld <= 0) {
    return { ...acc, holdingsByTickerId };
  }

  const splitPrice = assertToFloat(entry.purchasePrice);

  return {
    holdingsByTickerId,
    resolvedEntries: [
      ...acc.resolvedEntries,
      createSyntheticSplitEntry({
        entry,
        transactionType: RESOLVED_TRANSACTION_TYPES.SELL,
        amount: currentSharesHeld,
        purchasePrice: splitPrice,
        splitStep: 0,
      }),
      createSyntheticSplitEntry({
        entry,
        transactionType: RESOLVED_TRANSACTION_TYPES.BUY,
        amount: postSplitSharesHeld,
        purchasePrice: splitPrice / splitRatio,
        splitStep: 1,
      }),
    ],
  };
}

function createResolvedEntry({
  entry,
  transactionType,
}: {
  entry: PersistedPortfolioEntry;
  transactionType: ResolvedPortfolioEntry['transactionType'];
}): ResolvedPortfolioEntryWithSortMetadata {
  return { entry: { ...entry, transactionType }, splitOrderGroup: entry.id, splitOrderStep: 0 };
}

function createSyntheticSplitEntry({
  entry,
  transactionType,
  amount,
  purchasePrice,
  splitStep,
}: {
  entry: PersistedPortfolioEntry;
  transactionType: ResolvedPortfolioEntry['transactionType'];
  amount: number;
  purchasePrice: number;
  splitStep: number;
}): ResolvedPortfolioEntryWithSortMetadata {
  return {
    entry: {
      ...entry,
      id: getSyntheticSplitEntryId(entry.id, transactionType),
      amount,
      purchasePrice,
      transactionType,
    },
    splitOrderGroup: entry.id,
    splitOrderStep: splitStep,
  };
}

function getSyntheticSplitEntryId(splitEntryId: string, transactionType: ResolvedPortfolioEntry['transactionType']) {
  const bytes = crypto.createHash('sha256').update(`${splitEntryId}:${transactionType}`).digest().subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function compareEntriesAscending(left: PersistedPortfolioEntry, right: PersistedPortfolioEntry) {
  return compareEntryDates(left, right);
}

function compareEntriesDescending(
  left: ResolvedPortfolioEntryWithSortMetadata,
  right: ResolvedPortfolioEntryWithSortMetadata,
) {
  return compareResolvedEntryOrder(right, left);
}

function compareEntryDates(
  left: Pick<PersistedPortfolioEntry, 'transactionDate' | 'updatedAt' | 'createdAt'>,
  right: Pick<PersistedPortfolioEntry, 'transactionDate' | 'updatedAt' | 'createdAt'>,
) {
  return (
    left.transactionDate.localeCompare(right.transactionDate) ||
    left.updatedAt.getTime() - right.updatedAt.getTime() ||
    left.createdAt.getTime() - right.createdAt.getTime()
  );
}

function compareResolvedEntryOrder(
  left: ResolvedPortfolioEntryWithSortMetadata,
  right: ResolvedPortfolioEntryWithSortMetadata,
) {
  const dateComparison = compareEntryDates(left.entry, right.entry);
  if (dateComparison !== 0) {
    return dateComparison;
  }
  if (left.splitOrderGroup !== right.splitOrderGroup) {
    return 0;
  }

  return left.splitOrderStep - right.splitOrderStep;
}
