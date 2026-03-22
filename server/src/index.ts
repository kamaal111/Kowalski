import { showRoutes } from 'hono/dev';
import { requestId } from 'hono/request-id';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';

import env, { IS_TEST } from './api/env';
import { openAPIRouterFactory, withOpenAPIDocumentation } from './api/open-api';
import loggingMiddleware from './middleware/logging';
import { injectRequestContext } from './api/contexts';
import { auth, createAuth } from './auth';

import db from './db';
import appApi from './app-api';
import { APP_API_BASE_PATH, DAILY_API_BASE_PATH, REQUEST_ID_HEADER_NAME } from './constants/common';
import dailyApi from './daily-api';
import { NotFound } from './api/exceptions';
import type { Database } from './db';
import { startServer } from './api/server';

const { DEBUG } = env;

export function createApp(dbOverride?: Database) {
  const database = dbOverride ?? db;
  const authentication = dbOverride ? createAuth(database) : auth;

  return withOpenAPIDocumentation(
    openAPIRouterFactory()
      .use(requestId({ headerName: REQUEST_ID_HEADER_NAME }))
      .use(compress())
      .use(secureHeaders())
      .use(loggingMiddleware)
      .use(injectRequestContext({ db: database, auth: authentication }))
      .route(APP_API_BASE_PATH, appApi)
      .route(DAILY_API_BASE_PATH, dailyApi),
  ).all('/*', c => {
    throw new NotFound(c);
  });
}

const app = createApp();

if (DEBUG) {
  showRoutes(app, { verbose: false });
}

if (!IS_TEST) {
  startServer(app);
}
