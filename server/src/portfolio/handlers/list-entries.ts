import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import listPortfolioEntries from '../services/list-entries';
import { ListEntriesResponseSchema, type ListEntriesResponse } from '../schemas/responses';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { mapResolvedPortfolioEntryToResponse } from '../mappers/entry-response';

async function listEntries(c: HonoContext): Promise<TypedResponse<ListEntriesResponse, typeof STATUS_CODES.OK>> {
  const entries = await listPortfolioEntries(c);
  const response = ListEntriesResponseSchema.parse(entries.map(mapResolvedPortfolioEntryToResponse));
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entries.listed',
    result_count: response.length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default listEntries;
