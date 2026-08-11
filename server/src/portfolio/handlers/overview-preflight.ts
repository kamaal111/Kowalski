import type { OverviewPreflightRouteResponse } from '../routes/overview-preflight.ts';

import { STATUS_CODES } from '../../constants/http.ts';
import type { HonoContext } from '../../api/contexts.ts';
import { PortfolioOverviewPreflightResponseSchema } from '../schemas/responses.ts';
import { getPortfolioOverviewPreflight } from '../services/overview-preflight.ts';

async function overviewPreflight(c: HonoContext): Promise<OverviewPreflightRouteResponse> {
  const result = await getPortfolioOverviewPreflight(c);
  const response = PortfolioOverviewPreflightResponseSchema.parse(result);

  return c.json(response, STATUS_CODES.OK);
}

export default overviewPreflight;
