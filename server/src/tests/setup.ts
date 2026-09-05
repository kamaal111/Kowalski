import { beforeEach } from 'vitest';

import { initializeTestLogs } from './logs.ts';
import YahooFinanceMock, { resetYahooFinanceMocks } from './mocks/yahoo-finance.ts';
import { resetHoldingsRefreshCoordinatorForTests } from '../portfolio/services/holdings-refresh-coordinator.ts';
import { setYahooFinanceClientForTests } from '../utils/yahoo-finance.ts';

initializeTestLogs();
setYahooFinanceClientForTests(new YahooFinanceMock());
beforeEach(() => {
  resetYahooFinanceMocks();
  resetHoldingsRefreshCoordinatorForTests();
});
