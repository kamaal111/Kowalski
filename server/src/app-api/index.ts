import { HTTPException } from 'hono/http-exception';

import { InvalidValidation } from '../api/exceptions.js';
import { openAPIRouterFactory } from '../api/open-api.js';
import { AUTH_ROUTE_NAME, authApi } from '../auth/index.js';
import type { HonoContext } from '../api/contexts.js';
import { errorLogger, makeUncaughtErrorLog } from '../middleware/logging.js';
import { STATUS_CODES } from '../constants/http.js';
import { STOCKS_ROUTE_NAME, stocksApi } from '../stocks/index.js';
import { SERVER_MODES } from '../api/env.js';
import { allowedModes } from '../api/middleware.js';
import { PORTFOLIO_ROUTE_NAME, portfolioApi } from '@/portfolio/index.js';

const appApi = openAPIRouterFactory();

appApi
  .use(allowedModes(SERVER_MODES.SERVER))
  .route(AUTH_ROUTE_NAME, authApi)
  .route(STOCKS_ROUTE_NAME, stocksApi)
  .route(PORTFOLIO_ROUTE_NAME, portfolioApi)
  .onError((err, c) => {
    const ctx = c as HonoContext;
    if (err instanceof InvalidValidation) {
      errorLogger(
        ctx,
        `[ERROR HANDLER] Returning validation error response with ${err.validationError.issues.length} issue(s)`,
      );
      return c.json({ message: err.message, validations: err.validationError.issues }, err.status);
    }

    if (err instanceof HTTPException) {
      errorLogger(ctx, `[ERROR HANDLER] HTTP ${err.status}: ${err.message}`);
      return c.json({ message: err.message }, err.status);
    }

    makeUncaughtErrorLog(ctx, err);

    return c.json({ message: 'Something went wrong' }, STATUS_CODES.INTERNAL_SERVER_ERROR);
  });

export default appApi;
