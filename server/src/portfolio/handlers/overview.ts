import type { OverviewRouteResponse } from '../routes/overview.ts';

import { STATUS_CODES } from '../../constants/http.ts';
import { logInfo } from '../../logging/index.ts';
import { withRequestLogger } from '../../logging/http.ts';
import type { HonoContext } from '../../api/contexts.ts';
import { mapResolvedPortfolioEntryToResponse } from '../mappers/entry-response.ts';
import { PortfolioOverviewResponseSchema } from '../schemas/responses.ts';
import getPortfolioOverview from '../services/overview.ts';

async function overview(c: HonoContext): Promise<OverviewRouteResponse> {
  const result = await getPortfolioOverview(c);
  const response = PortfolioOverviewResponseSchema.parse({
    transactions: result.transactions.map(entry => {
      return mapResolvedPortfolioEntryToResponse({
        c,
        entry: entry.entry,
        preferredCurrencyPurchasePrice: entry.preferredCurrencyPurchasePrice,
      });
    }),
    current_values: result.currentValues,
    holdings: result.holdings,
    net_worth: result.netWorth,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.overview.retrieved',
    transaction_count: response.transactions.length,
    holding_count: response.holdings.length,
    stored_count: Object.keys(response.current_values).length,
    net_worth_currency: response.net_worth.currency,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

export default overview;
