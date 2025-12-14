import { serve } from '@hono/node-server';
import { showRoutes } from 'hono/dev';
import { requestId } from 'hono/request-id';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';

import env from './api/env.js';
import { openAPIRouterFactory, withOpenAPIDocumentation } from './api/open-api.js';
import loggingMiddleware from './middleware/logging.js';
import { injectRequestContext } from './api/contexts.js';
import { auth, createAuth } from './auth/index.js';

import db from './db/index.js';
import appApi from './app-api/index.js';
import { APP_API_BASE_PATH, DAILY_API_BASE_PATH } from './constants/common.js';
import dailyApi from './daily-api/index.js';
import { NotFound } from './api/exceptions.js';
import type { Database } from './db/index.js';

const { PORT, DEBUG } = env;

export const createApp = (dbOverride?: Database) => {
  const database = dbOverride ?? db;
  const authentication = dbOverride ? createAuth(database) : auth;

  return withOpenAPIDocumentation(
    openAPIRouterFactory()
      .use(requestId())
      .use(compress())
      .use(secureHeaders())
      .use(loggingMiddleware)
      .use(injectRequestContext({ db: database, auth: authentication }))
      .route(APP_API_BASE_PATH, appApi)
      .route(DAILY_API_BASE_PATH, dailyApi),
  ).all('/*', c => {
    throw new NotFound(c);
  });
};

const app = createApp();

if (DEBUG) {
  showRoutes(app, { verbose: false });
}

if (process.env.MODE !== 'TEST') {
  serve({ fetch: app.fetch, port: PORT }, info => console.log(`Server is running on :${info.port}`));
}

export default app;
