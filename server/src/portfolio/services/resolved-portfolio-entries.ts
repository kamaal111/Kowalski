import type { HonoContext } from '../../api/contexts.ts';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries.ts';
import { resolveSplits, type ResolvedPortfolioEntry } from './resolve-splits.ts';

export async function findResolvedPortfolioEntriesByUserId(c: HonoContext): Promise<ResolvedPortfolioEntry[]> {
  const portfolioEntries = await findPortfolioEntriesByUserId(c);

  return resolveSplits(portfolioEntries);
}
