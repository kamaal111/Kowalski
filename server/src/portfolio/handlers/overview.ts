import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { mapPersistedPortfolioEntryToResponse } from '../mappers/entry-response';
import type { PortfolioOverviewResponse } from '../schemas/responses';
import getPortfolioOverview from '../services/overview';

async function overview(c: HonoContext): Promise<TypedResponse<PortfolioOverviewResponse, typeof STATUS_CODES.OK>> {
  const result = await getPortfolioOverview(c);
  const response = {
    transactions: result.transactions.map(mapPersistedPortfolioEntryToResponse),
    current_values: result.currentValues,
  } satisfies PortfolioOverviewResponse;
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.overview.retrieved',
    result_count: response.transactions.length,
    stored_count: Object.keys(response.current_values).length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default overview;
