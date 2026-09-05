import type { HonoContext } from '../../api/contexts.ts';
import type { StocksSearchQuery } from '../schemas/search.ts';
import { STATUS_CODES } from '../../constants/http.ts';
import { mapYahooFinanceSearchQuoteToEquitySearchResponse } from '../mappers/yahoo-finance.ts';
import { ONE_MINUTE_IN_MILLISECONDS } from '../../constants/common.ts';
import { withCache } from '../../middleware/cache.ts';
import { logInfo } from '../../logging/index.ts';
import { withRequestLogger } from '../../logging/http.ts';
import { yahooFinanceClient } from '../../utils/yahoo-finance.ts';

type SearchContext = HonoContext<string, { out: { query: StocksSearchQuery } }>;

async function searchHandlerImpl(c: SearchContext) {
  const params = c.req.valid('query');
  const results = await yahooFinanceClient.search(params.q);
  const response = mapYahooFinanceSearchQuoteToEquitySearchResponse(results);
  logInfo(withRequestLogger(c, { component: 'stocks' }), {
    event: 'stocks.search.completed',
    query_length: params.q.length,
    result_count: response.count,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

const searchHandler = withCache(searchHandlerImpl, {
  keyPrefix: 'stocks:search',
  maxSize: 1000,
  defaultTTL: 30 * ONE_MINUTE_IN_MILLISECONDS,
});

export default searchHandler;
