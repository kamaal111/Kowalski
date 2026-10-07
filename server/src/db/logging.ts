import type { Logger } from 'drizzle-orm/logger';

import { getComponentLogger, logInfo, type ServerLogger } from '../logging/index.ts';

/** Log SQL templates only: parameter values can contain credentials or personal data. */
export function createDatabaseQueryLogger(logger: ServerLogger = getComponentLogger('database')): Logger {
  return {
    logQuery(query) {
      logInfo(logger, { event: 'database.query', query }, 'Executing database query.');
    },
  };
}
