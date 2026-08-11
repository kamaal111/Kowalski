import { openAPIRouterFactory } from '../api/open-api.ts';
import { AUTH_ROUTE_NAME, authModule } from '../auth/index.ts';
import { FOREX_ROUTE_NAME, forexCompatApi } from '../forex/index.ts';
import { STOCKS_ROUTE_NAME, stocksApi } from '../stocks/index.ts';
import { SERVER_MODES } from '../api/env.ts';
import { allowedModes } from '../api/middleware.ts';
import { PORTFOLIO_ROUTE_NAME, portfolioApi } from '../portfolio/index.ts';
import { handleServerError } from '../middleware/logging.ts';

const appApi = openAPIRouterFactory();

appApi
  .onError(handleServerError)
  .use(allowedModes(SERVER_MODES.SERVER))
  .route(AUTH_ROUTE_NAME, authModule.router)
  .route(FOREX_ROUTE_NAME, forexCompatApi)
  .route(STOCKS_ROUTE_NAME, stocksApi)
  .route(PORTFOLIO_ROUTE_NAME, portfolioApi);

export default appApi;
