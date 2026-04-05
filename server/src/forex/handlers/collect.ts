import type { HonoContext } from '../../api/contexts';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { collectLatestExchangeRates } from '../services/collect';

export const FOREX_COLLECT_ROUTE_PATH = '/daily-api/forex/collect';

async function collect(c: HonoContext) {
  const logger = withRequestLogger(c, { component: 'forex' });
  logInfo(logger, {
    event: 'forex.collect.started',
    route: FOREX_COLLECT_ROUTE_PATH,
    outcome: 'success',
  });

  const result = await collectLatestExchangeRates({
    db: c.get('db'),
    logger,
  });
  if (result.status === 'skipped') {
    logInfo(logger, {
      event: 'forex.collect.skipped',
      route: FOREX_COLLECT_ROUTE_PATH,
      latest_collected_date: result.latestCollectedDay,
      target_date: result.targetCollectionDay,
      outcome: 'success',
    });

    return c.json({ data: { date: result.targetCollectionDay, stored: 0 }, skipped: true }, 200);
  }

  if (result.status === 'no-data') {
    logInfo(logger, {
      event: 'forex.collect.no_data',
      route: FOREX_COLLECT_ROUTE_PATH,
      outcome: 'failure',
    });

    return c.json({ message: 'No exchange rates found' }, 404);
  }

  logInfo(logger, {
    event: 'forex.collect.persisted',
    route: FOREX_COLLECT_ROUTE_PATH,
    stored_count: result.storedItems.length,
    outcome: 'success',
  });

  return c.json(
    { data: { exchangeRate: result.exchangeRate, stored: result.storedItems.length }, skipped: false },
    200,
  );
}

export default collect;
