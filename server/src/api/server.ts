import { serve, type ServerType } from '@hono/node-server';
import type { Env, Hono } from 'hono';
import type { BlankEnv } from 'hono/types';

import { closeAllCaches } from '@/middleware/cache';
import env from './env';

const { PORT } = env;
const SIGNALS_TO_TERMINATE_ON: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export function startServer<E extends Env = BlankEnv>(app: Hono<E>) {
  const server = serve({ fetch: app.fetch, port: PORT }, info => console.log(`Server is running on :${info.port}`));

  for (const signal of SIGNALS_TO_TERMINATE_ON) {
    process.on(signal, () => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      shutdownServer(server);
    });
  }
}

function shutdownServer(server: ServerType) {
  closeAllCaches();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}
