import YahooFinance from 'yahoo-finance2';

import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import type { StocksSearchQuery } from '../schemas/search.js';
import { mapYahooFinanceSearchQuoteToEquitySearchResponse } from '../mappers/yahoo-finance.js';

const yahooFinance = new YahooFinance();

async function searchHandler(c: HonoContext<string, { out: { query: StocksSearchQuery } }>) {
  const params = c.req.valid('query');
  const results = await yahooFinance.search(params.q);
  const response = mapYahooFinanceSearchQuoteToEquitySearchResponse(results);

  return c.json(response, STATUS_CODES.OK);
}

export default searchHandler;
