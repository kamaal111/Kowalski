import { openAPIRouterFactory } from '../api/open-api';
import { AUTH_ROUTE_NAME, authApi } from '../auth';
import { FOREX_ROUTE_NAME, forexCompatApi } from '../forex';
import { STOCKS_ROUTE_NAME, stocksApi } from '../stocks';
import { SERVER_MODES } from '../api/env';
import { allowedModes } from '../api/middleware';
import { PORTFOLIO_ROUTE_NAME, portfolioApi } from '@/portfolio';
import { handleServerError } from '@/middleware/logging';

const appApi = openAPIRouterFactory();

appApi
  .onError(handleServerError)
  .use(allowedModes(SERVER_MODES.SERVER))
  .route(AUTH_ROUTE_NAME, authApi)
  .route(FOREX_ROUTE_NAME, forexCompatApi)
  .route(STOCKS_ROUTE_NAME, stocksApi)
  .route(PORTFOLIO_ROUTE_NAME, portfolioApi);

export default appApi;
