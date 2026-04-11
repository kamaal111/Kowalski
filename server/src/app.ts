import { $ } from '@hono/zod-openapi';
import { compress } from 'hono/compress';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { injectRequestContext } from './api/contexts';
import { NotFound } from './api/exceptions';
import {
  OPENAPI_DEFAULT_SERVER_URL,
  OPENAPI_YAML_SPEC_PATH,
  openAPIRouterFactory,
  withOpenAPIDocumentation,
} from './api/open-api';
import { auth, createAuth } from './auth';
import appApi from './app-api';
import { APP_API_BASE_PATH, DAILY_API_BASE_PATH, REQUEST_ID_HEADER_NAME } from './constants/common';
import dailyApi from './daily-api';
import db from './db';
import type { Database } from './db';
import loggingMiddleware, { handleServerError } from './middleware/logging';

export function createApp(dbOverride?: Database) {
  const database = dbOverride ?? db;
  const authentication = dbOverride ? createAuth(database) : auth;
  const app = $(
    openAPIRouterFactory()
      .onError(handleServerError)
      .use(requestId({ headerName: REQUEST_ID_HEADER_NAME }))
      .use(compress())
      .use(secureHeaders())
      .use(loggingMiddleware)
      .use(injectRequestContext({ db: database, auth: authentication }))
      .route(APP_API_BASE_PATH, appApi)
      .route(DAILY_API_BASE_PATH, dailyApi),
  );

  return withOpenAPIDocumentation(app).all('/*', c => new NotFound(c).getResponse());
}

export async function generateOpenAPISpecYaml() {
  const response = await createApp().request(`${OPENAPI_DEFAULT_SERVER_URL}${OPENAPI_YAML_SPEC_PATH}`, {
    headers: { Accept: 'text/yaml' },
  });

  if (!response.ok) {
    throw new Error(`Failed to generate OpenAPI spec: HTTP ${response.status} ${response.statusText}`);
  }

  return await response.text();
}
