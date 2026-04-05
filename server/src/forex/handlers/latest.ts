import { desc, eq } from 'drizzle-orm';

import { NotFound } from '@/api/exceptions';
import type { HonoContext } from '@/api/contexts';
import { APP_API_BASE_PATH } from '@/constants/common';
import { STATUS_CODES } from '@/constants/http';
import { exchangeRates } from '@/db/schema/forex';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { BASE_CURRENCY, ROUTE_NAME } from '../constants';
import latestRoute from '../routes/latest';
import type { ForexLatestQuery, ForexLatestResponse } from '../schemas/latest';
import isCurrency from '../utils/is-currency';

const LATEST_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${latestRoute.path}` as const;

async function latestHandler(c: HonoContext<string, { out: { query: ForexLatestQuery } }>) {
  const logger = withRequestLogger(c, { component: 'forex' });
  const query = c.req.valid('query');
  const requestedBase = normalizeRequestedBase(query.base);
  const resolvedBase = resolveBaseCurrency(requestedBase);

  logInfo(logger, {
    event: 'forex.latest.started',
    route: LATEST_ROUTE_PATH,
    requested_base: requestedBase ?? BASE_CURRENCY,
    resolved_base: resolvedBase,
    outcome: 'success',
  });

  const latestRate = await c
    .get('db')
    .select({ base: exchangeRates.base, date: exchangeRates.date, rates: exchangeRates.rates })
    .from(exchangeRates)
    .where(eq(exchangeRates.base, resolvedBase))
    .orderBy(desc(exchangeRates.date))
    .limit(1);

  const storedRate = latestRate.at(0);
  if (storedRate == null) {
    logInfo(logger, {
      event: 'forex.latest.not_found',
      route: LATEST_ROUTE_PATH,
      base: resolvedBase,
      outcome: 'failure',
    });

    throw new NotFound(c, { message: 'No exchange rates found' });
  }

  const filteredRates = filterRates({
    base: resolvedBase,
    symbols: query.symbols,
    rates: storedRate.rates,
  });
  const response = {
    base: storedRate.base,
    date: storedRate.date,
    rates: filteredRates,
  } satisfies ForexLatestResponse;

  logInfo(logger, {
    event: 'forex.latest.completed',
    route: LATEST_ROUTE_PATH,
    base: response.base,
    result_count: Object.keys(response.rates).length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.OK);
}

function normalizeRequestedBase(base: string | undefined) {
  const normalizedBase = base?.trim().toUpperCase();
  return normalizedBase != null && normalizedBase.length > 0 ? normalizedBase : undefined;
}

function resolveBaseCurrency(base: string | undefined) {
  return base != null && isCurrency(base) ? base : BASE_CURRENCY;
}

function filterRates({
  base,
  symbols,
  rates,
}: {
  base: string;
  symbols: string | undefined;
  rates: Record<string, number>;
}) {
  const requestedSymbols = parseRequestedSymbols(symbols, base);
  if (requestedSymbols == null) {
    return rates;
  }

  return requestedSymbols.reduce<Record<string, number>>((filteredRates, symbol) => {
    const rate = rates[symbol];
    if (typeof rate !== 'number') {
      return filteredRates;
    }

    return { ...filteredRates, [symbol]: rate };
  }, {});
}

function parseRequestedSymbols(symbols: string | undefined, base: string) {
  if (symbols == null) {
    return;
  }

  const trimmedSymbols = symbols.trim();
  if (trimmedSymbols.length === 0 || trimmedSymbols === '*') {
    return;
  }

  const parsedSymbols = trimmedSymbols
    .split(',')
    .map(symbol => symbol.trim().toUpperCase())
    .filter(symbol => symbol.length > 0 && symbol !== base && isCurrency(symbol));

  return Array.from(new Set(parsedSymbols));
}

export default latestHandler;
