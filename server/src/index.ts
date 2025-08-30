import { serve } from '@hono/node-server';
import { showRoutes } from 'hono/dev';
import { requestId } from 'hono/request-id';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';

import env from './api/env.js';
import { openAPIRouterFactory, withOpenAPIDocumentation } from './api/open-api.js';
import loggingMiddleware from './middleware/logging.js';
import { injectRequestContext } from './api/contexts.js';
import authApi from './routes/auth/index.js';
import db from './db/index.js';
import { auth } from './auth/better-auth.js';

const app = withOpenAPIDocumentation(
  openAPIRouterFactory()
    .use(requestId())
    .use(compress())
    .use(secureHeaders())
    .use(loggingMiddleware)
    .use(injectRequestContext({ db, auth }))
    .route('/auth', authApi),
);

const { PORT, DEBUG } = env;
if (DEBUG) {
  showRoutes(app, { verbose: false });
}

serve({ fetch: app.fetch, port: PORT }, info => console.log(`Server is running on :${info.port}`));
