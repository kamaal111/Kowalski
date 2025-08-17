import { serve } from '@hono/node-server';
import { showRoutes } from 'hono/dev';
import { requestId } from 'hono/request-id';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { drizzle } from 'drizzle-orm/node-postgres';

import env from './api/env.js';
import { openAPIRouterFactory, withOpenAPIDocumentation } from './api/open-api.js';
import loggingMiddleware from './middleware/logging.js';
import { injectRequestContext } from './api/contexts.js';
import * as schema from './db/schema.js';

const { PORT, DEBUG, DATABASE_URL } = env;
const db = drizzle(DATABASE_URL, { schema });

const app = withOpenAPIDocumentation(
  openAPIRouterFactory()
    .use(requestId())
    .use(compress())
    .use(secureHeaders())
    .use(loggingMiddleware)
    .use(injectRequestContext({ db }))
    .get('/', c => c.text('Hello Hono!')),
);

if (DEBUG) {
  showRoutes(app, { verbose: false });
}

serve({ fetch: app.fetch, port: PORT }, info => console.log(`Server is running on :${info.port}`));
