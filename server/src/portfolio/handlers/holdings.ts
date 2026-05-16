import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { PortfolioHoldingsResponseSchema, type PortfolioHoldingsResponse } from '../schemas/responses';
import getPortfolioHoldings from '../services/holdings';

async function holdings(c: HonoContext): Promise<TypedResponse<PortfolioHoldingsResponse, typeof STATUS_CODES.OK>> {
  const result = await getPortfolioHoldings(c);
  const response = PortfolioHoldingsResponseSchema.parse({
    net_worth: result.netWorth,
    holdings: result.holdings,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.holdings.retrieved',
    result_count: response.holdings.length,
    net_worth_currency: response.net_worth.currency,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default holdings;
