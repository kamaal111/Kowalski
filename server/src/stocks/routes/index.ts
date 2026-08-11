import { SERVER_MODES } from '../../api/env.ts';
import { allowedModes } from '../../api/middleware.ts';
import { openAPIRouterFactory } from '../../api/open-api.ts';
import { requireLoggedInSessionMiddleware } from '../../auth/index.ts';
import searchHandler from '../handlers/search.ts';
import searchRoute from './search.ts';

const stocksApi = openAPIRouterFactory();

stocksApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

stocksApi
  // GET: /search
  .openapi(searchRoute, searchHandler);

export default stocksApi;
