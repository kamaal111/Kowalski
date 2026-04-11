import { showRoutes } from 'hono/dev';

import env, { IS_TEST } from './api/env';
import { startServer } from './api/server';
import { createApp } from './app';

const { DEBUG } = env;

export { createApp, generateOpenAPISpecYaml } from './app';

if (import.meta.main && !IS_TEST) {
  const app = createApp();

  if (DEBUG) {
    showRoutes(app, { verbose: false });
  }

  startServer(app);
}
