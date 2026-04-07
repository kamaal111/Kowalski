import { beforeEach, vi } from 'vitest';

import { initializeTestLogs } from './logs';
import { resetYahooFinanceMocks } from './mocks/yahoo-finance';

initializeTestLogs();
beforeEach(() => {
  resetYahooFinanceMocks();
});

vi.mock('yahoo-finance2', async () => {
  const module = await import('./mocks/yahoo-finance');

  return {
    default: module.default,
  };
});
