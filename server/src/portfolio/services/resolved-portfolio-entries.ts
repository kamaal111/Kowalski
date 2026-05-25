import type { HonoContext } from '@/api/contexts';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import { resolveSplits, type ResolvedPortfolioEntry } from './resolve-splits';

export async function findResolvedPortfolioEntriesByUserId(c: HonoContext): Promise<ResolvedPortfolioEntry[]> {
  const portfolioEntries = await findPortfolioEntriesByUserId(c);

  return resolveSplits(portfolioEntries);
}
