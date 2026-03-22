import { HTTPException } from 'hono/http-exception';

import { InvalidValidation } from '../api/exceptions';
import { openAPIRouterFactory } from '../api/open-api';
import { AUTH_ROUTE_NAME, authApi } from '../auth';
import type { HonoContext } from '../api/contexts';
import { errorLogger, makeUncaughtErrorLog } from '../middleware/logging';
import { STATUS_CODES } from '../constants/http';
import { STOCKS_ROUTE_NAME, stocksApi } from '../stocks';
import { SERVER_MODES } from '../api/env';
import { allowedModes } from '../api/middleware';
import { PORTFOLIO_ROUTE_NAME, portfolioApi } from '@/portfolio';

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
