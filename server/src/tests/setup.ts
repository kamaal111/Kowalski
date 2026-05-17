import { beforeEach, vi } from 'vitest';

import { initializeTestLogs } from './logs';
import { resetYahooFinanceMocks } from './mocks/yahoo-finance';
import { resetHoldingsRefreshCoordinatorForTests } from '@/portfolio/services/holdings-refresh-coordinator';

initializeTestLogs();
beforeEach(() => {
  resetYahooFinanceMocks();
  resetHoldingsRefreshCoordinatorForTests();
});

vi.mock('yahoo-finance2', async () => {
  const module = await import('./mocks/yahoo-finance');

  return {
    default: module.default,
  };
});
