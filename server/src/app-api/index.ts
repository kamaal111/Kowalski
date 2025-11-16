import { HTTPException } from 'hono/http-exception';

import { InvalidValidation } from '../api/exceptions.js';
import { openAPIRouterFactory } from '../api/open-api.js';
import { AUTH_ROUTE_NAME, authApi } from '../auth/index.js';
import { AppAPIRouteNotFound } from './exceptions.js';
import type { HonoContext } from '../api/contexts.js';
import { makeUncaughtErrorLog } from '../middleware/logging.js';
import { STATUS_CODES } from '../constants/http.js';
import { STOCKS_ROUTE_NAME, stocksApi } from '../stocks/index.js';

const appApi = openAPIRouterFactory();

appApi
  .route(AUTH_ROUTE_NAME, authApi)
  .route(STOCKS_ROUTE_NAME, stocksApi)
  .all('/*', c => {
    throw new AppAPIRouteNotFound(c);
  })
  .onError((err, c) => {
    if (err instanceof InvalidValidation) {
      return c.json({ message: err.message, validations: err.validationError.issues }, err.status);
    }

    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status);
    }

    makeUncaughtErrorLog(c as HonoContext, err);

    return c.json({ message: 'Something went wrong' }, STATUS_CODES.INTERNAL_SERVER_ERROR);
  });

export default appApi;
