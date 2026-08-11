import { beforeEach, vi } from 'vitest';

import { initializeTestLogs } from './logs.ts';
import { resetYahooFinanceMocks } from './mocks/yahoo-finance.ts';
import { resetHoldingsRefreshCoordinatorForTests } from '../portfolio/services/holdings-refresh-coordinator.ts';

initializeTestLogs();
beforeEach(() => {
  resetYahooFinanceMocks();
  resetHoldingsRefreshCoordinatorForTests();
});

vi.mock('yahoo-finance2', async () => {
  const module = await import('./mocks/yahoo-finance.ts');

  return {
    default: module.default,
  };
});
