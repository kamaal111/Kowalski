import { serve, type ServerType } from '@hono/node-server';
import type { Env, Hono } from 'hono';
import type { BlankEnv } from 'hono/types';

import { closeAllCaches } from '@/middleware/cache';
import { getComponentLogger, logInfo, logWarn } from '@/logging';
import env from './env';

const { PORT } = env;
const SIGNALS_TO_TERMINATE_ON: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

const logger = getComponentLogger('server');

export function startServer<E extends Env = BlankEnv>(app: Hono<E>) {
  const server = serve({ fetch: app.fetch, port: PORT }, info => {
    logInfo(logger, { event: 'server.started', port: info.port, outcome: 'success' });
  });

  for (const signal of SIGNALS_TO_TERMINATE_ON) {
    process.on(signal, () => {
      logInfo(logger, { event: 'server.shutdown.started', signal, outcome: 'success' });
      shutdownServer(server);
    });
  }
}

function shutdownServer(server: ServerType) {
  closeAllCaches();
  server.close(() => {
    logInfo(logger, { event: 'server.shutdown.completed', outcome: 'success' });
    process.exit(0);
  });

  setTimeout(() => {
    logWarn(logger, { event: 'server.shutdown.forced', outcome: 'failure' });
    process.exit(1);
  }, 10_000);
}
