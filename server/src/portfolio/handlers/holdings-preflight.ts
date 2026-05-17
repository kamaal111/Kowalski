import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import type { HonoContext } from '@/api/contexts';
import {
  PortfolioHoldingsPreflightResponseSchema,
  type PortfolioHoldingsPreflightResponse,
} from '../schemas/responses';
import { getPortfolioHoldingsPreflight } from '../services/holdings-preflight';

async function holdingsPreflight(
  c: HonoContext,
): Promise<TypedResponse<PortfolioHoldingsPreflightResponse, typeof STATUS_CODES.OK>> {
  const result = await getPortfolioHoldingsPreflight(c);
  const response = PortfolioHoldingsPreflightResponseSchema.parse(result);

  return c.json(response, STATUS_CODES.OK);
}

export default holdingsPreflight;
