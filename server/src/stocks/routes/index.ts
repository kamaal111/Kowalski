import { SERVER_MODES } from '../../api/env.js';
import { allowedModes } from '../../api/middleware.js';
import { openAPIRouterFactory } from '../../api/open-api.js';
import { requireLoggedInSessionMiddleware } from '../../auth/middleware.js';
import searchHandler from '../handlers/search.js';
import searchRoute from './search.js';

const stocksApi = openAPIRouterFactory();

stocksApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

stocksApi
  // GET: /search
  .openapi(searchRoute, searchHandler);

export default stocksApi;
