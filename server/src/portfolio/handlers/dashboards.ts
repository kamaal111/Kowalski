import type { DashboardsRouteResponse } from '../routes/dashboards.ts';

import type { HonoContext } from '../../api/contexts.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { logInfo } from '../../logging/index.ts';
import { withRequestLogger } from '../../logging/http.ts';
import type { PortfolioDashboardsQuery } from '../schemas/queries.ts';
import { PortfolioDashboardsResponseSchema } from '../schemas/responses.ts';
import getPortfolioDashboards from '../services/dashboards.ts';

async function dashboards(
  c: HonoContext<string, { out: { query: PortfolioDashboardsQuery } }>,
): Promise<DashboardsRouteResponse> {
  const query = c.req.valid('query');
  const result = await getPortfolioDashboards(c, { period: query.period });
  const response = PortfolioDashboardsResponseSchema.parse({
    portfolio_growth_over_time: result.portfolioGrowthOverTime,
    portfolio_holdings_distribution: result.portfolioHoldingsDistribution,
  });

  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.dashboards.retrieved',
    period: query.period,
    growth_point_count: response.portfolio_growth_over_time.points.length,
    holding_count: response.portfolio_holdings_distribution.holdings.length,
    currency: response.portfolio_growth_over_time.currency,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default dashboards;
