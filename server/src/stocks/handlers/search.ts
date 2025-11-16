import YahooFinance from 'yahoo-finance2';

import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import type { StocksSearchParams } from '../schemas/search.js';

const yahooFinance = new YahooFinance();

async function searchHandler(c: HonoContext<string, { out: { param: StocksSearchParams } }>) {
  const params = c.req.valid('param');
  const results = await yahooFinance.search(params.query);

  console.log('🐸🐸🐸 results', results);
  return c.json({}, STATUS_CODES.OK);
}

export default searchHandler;
