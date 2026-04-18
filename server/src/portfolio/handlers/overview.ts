import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { mapResolvedPortfolioEntryToResponse } from '../mappers/entry-response';
import { PortfolioOverviewResponseSchema, type PortfolioOverviewResponse } from '../schemas/responses';
import getPortfolioOverview from '../services/overview';

async function overview(c: HonoContext): Promise<TypedResponse<PortfolioOverviewResponse, typeof STATUS_CODES.OK>> {
  const result = await getPortfolioOverview(c);
  const response = PortfolioOverviewResponseSchema.parse({
    transactions: result.transactions.map(mapResolvedPortfolioEntryToResponse),
    current_values: result.currentValues,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.overview.retrieved',
    result_count: response.transactions.length,
    stored_count: Object.keys(response.current_values).length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default overview;
