import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { mapResolvedPortfolioEntryToResponse } from '../mappers/entry-response';
import { PortfolioOverviewResponseSchema, type PortfolioOverviewResponse } from '../schemas/responses';
import getPortfolioOverview from '../services/overview';

async function overview(c: HonoContext): Promise<TypedResponse<PortfolioOverviewResponse, typeof STATUS_CODES.OK>> {
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
