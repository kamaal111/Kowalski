import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import type { HonoContext } from '@/api/contexts';
import {
  PortfolioOverviewPreflightResponseSchema,
  type PortfolioOverviewPreflightResponse,
} from '../schemas/responses';
import { getPortfolioOverviewPreflight } from '../services/overview-preflight';

async function overviewPreflight(
  c: HonoContext,
): Promise<TypedResponse<PortfolioOverviewPreflightResponse, typeof STATUS_CODES.OK>> {
  const result = await getPortfolioOverviewPreflight(c);
  const response = PortfolioOverviewPreflightResponseSchema.parse(result);

  return c.json(response, STATUS_CODES.OK);
}

export default overviewPreflight;
