import type { TypedResponse } from 'hono';

import type { HonoContext } from '@/api/contexts';
import { STATUS_CODES } from '@/constants/http';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { PortfolioDashboardsResponseSchema, type PortfolioDashboardsResponse } from '../schemas/responses';
import getPortfolioDashboards from '../services/dashboards';

async function dashboards(c: HonoContext): Promise<TypedResponse<PortfolioDashboardsResponse, typeof STATUS_CODES.OK>> {
  const result = await getPortfolioDashboards(c);
  const response = PortfolioDashboardsResponseSchema.parse({
    portfolio_growth_over_time: result.portfolioGrowthOverTime,
  });

  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.dashboards.retrieved',
    growth_point_count: response.portfolio_growth_over_time.points.length,
    currency: response.portfolio_growth_over_time.currency,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default dashboards;
