import YahooFinance from 'yahoo-finance2';

import type { HonoContext } from '../../api/contexts';
import type { StocksSearchQuery } from '../schemas/search';
import { STATUS_CODES } from '../../constants/http';
import { mapYahooFinanceSearchQuoteToEquitySearchResponse } from '../mappers/yahoo-finance';
import { ONE_MINUTE_IN_MILLISECONDS } from '../../constants/common';
import { withCache } from '../../middleware/cache';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';

const yahooFinance = new YahooFinance();

async function searchHandlerImpl(c: HonoContext<string, { out: { query: StocksSearchQuery } }>) {
  const params = c.req.valid('query');
  const results = await yahooFinance.search(params.q);
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
