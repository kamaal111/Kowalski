import { arrays } from '@kamaalio/kamaal';

import env from '@/api/env';
import type { HonoContext } from '@/api/contexts';
import { getSessionWhereSessionIsRequired } from '@/auth';
import { logError, logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { findPortfolioEntriesByUserId } from '../repositories/list-entries';
import { findLatestCachedPriceDateByTickerIds } from '../repositories/stock-prices';
import type { PortfolioHoldingsPreflightResponse } from '../schemas/responses';
import { aggregateHoldings } from './aggregate-holdings';
import { findResolvedAndMissingDailyPrices, refreshPortfolioDailyPrices } from './current-stock-values';
import {
  clearExpiredHoldingsRefreshStates,
  getHoldingsRefreshStatus,
  HOLDINGS_REFRESH_STATUSES,
  runHoldingsRefreshOnce,
  RUN_ONCE_RESULTS,
} from './holdings-refresh-coordinator';
import { resolveSplits, type ResolvedPortfolioEntry } from './resolve-splits';

interface ActiveTickerEntry {
  tickerId: string;
  stockSymbol: string;
}

export async function getPortfolioHoldingsPreflight(c: HonoContext): Promise<PortfolioHoldingsPreflightResponse> {
  const session = getSessionWhereSessionIsRequired(c);
  const today = new Date().toISOString().slice(0, 10);
  clearExpiredHoldingsRefreshStates(today);

  const entries = resolveSplits(await findPortfolioEntriesByUserId(c));
  const activeEntries = getActiveTickerEntries(entries);
  if (activeEntries.length === 0) {
    return logAndReturnPreflight(c, {
      refresh_state: 'ready',
      poll_after_ms: null,
      latest_cached_price_date: null,
    });
  }

  const tickerIds = activeEntries.map(entry => entry.tickerId);
  const latestCachedPriceDate = await findLatestCachedPriceDateByTickerIds(c, tickerIds);
  const { missingEntries } = await findResolvedAndMissingDailyPrices(c, activeEntries, today);
  if (missingEntries.length === 0) {
    return logAndReturnPreflight(c, {
      refresh_state: 'ready',
      poll_after_ms: null,
      latest_cached_price_date: today,
    });
  }

  const refreshKey = `${session.user.id}:${today}`;
  if (getHoldingsRefreshStatus(refreshKey) === HOLDINGS_REFRESH_STATUSES.COMPLETED) {
    return logAndReturnPreflight(c, {
      refresh_state: 'ready',
      poll_after_ms: null,
      latest_cached_price_date: latestCachedPriceDate,
    });
  }

  const refreshOutcome = runHoldingsRefreshOnce(refreshKey, async () => {
    try {
      await refreshPortfolioDailyPrices(c, activeEntries);
      logInfo(withRequestLogger(c, { component: 'portfolio' }), {
        event: 'portfolio.holdings.preflight.refresh.completed',
        user_id: session.user.id,
        ticker_count: activeEntries.length,
        missing_today_count: missingEntries.length,
        outcome: 'success',
      });
    } catch (error) {
      logError(
        withRequestLogger(c, { component: 'portfolio' }),
        {
          event: 'portfolio.holdings.preflight.refresh.failed',
          user_id: session.user.id,
          ticker_count: activeEntries.length,
          missing_today_count: missingEntries.length,
          outcome: 'failure',
        },
        error,
      );
    }
  });

  if (refreshOutcome === RUN_ONCE_RESULTS.COMPLETED) {
    return logAndReturnPreflight(c, {
      refresh_state: 'ready',
      poll_after_ms: null,
      latest_cached_price_date: latestCachedPriceDate,
    });
  }

  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event:
      refreshOutcome === RUN_ONCE_RESULTS.STARTED
        ? 'portfolio.holdings.preflight.refresh.started'
        : 'portfolio.holdings.preflight.refresh.reused',
    user_id: session.user.id,
    ticker_count: activeEntries.length,
    missing_today_count: missingEntries.length,
    refresh_state: HOLDINGS_REFRESH_STATUSES.REFRESHING,
    poll_after_ms: env.PORTFOLIO_HOLDINGS_PREFLIGHT_POLL_INTERVAL_MS,
    latest_cached_price_date: latestCachedPriceDate,
    outcome: 'success',
  });

  return logAndReturnPreflight(c, {
    refresh_state: HOLDINGS_REFRESH_STATUSES.REFRESHING,
    poll_after_ms: env.PORTFOLIO_HOLDINGS_PREFLIGHT_POLL_INTERVAL_MS,
    latest_cached_price_date: latestCachedPriceDate,
  });
}

function getActiveTickerEntries(entries: ResolvedPortfolioEntry[]): ActiveTickerEntry[] {
  return arrays.compactMap(aggregateHoldings(entries), holding => {
    if (holding.amount === 0) {
      return null;
    }
    return { tickerId: holding.entry.tickerId, stockSymbol: holding.entry.stockSymbol };
  });
}

function logAndReturnPreflight(
  c: HonoContext,
  response: PortfolioHoldingsPreflightResponse,
): PortfolioHoldingsPreflightResponse {
  const session = getSessionWhereSessionIsRequired(c);
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.holdings.preflight.checked',
    user_id: session.user.id,
    refresh_state: response.refresh_state,
    poll_after_ms: response.poll_after_ms,
    latest_cached_price_date: response.latest_cached_price_date,
    outcome: 'success',
  });

  return response;
}
