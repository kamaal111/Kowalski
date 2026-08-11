import { showRoutes } from 'hono/dev';

import env, { IS_TEST } from './api/env.ts';
import { startServer } from './api/server.ts';
import { createApp } from './app.ts';

const { DEBUG } = env;

export { createApp, generateOpenAPISpecYaml } from './app.ts';

if (import.meta.main && !IS_TEST) {
  const app = createApp();

  if (DEBUG) {
    showRoutes(app, { verbose: false });
  }

  startServer(app);
}
