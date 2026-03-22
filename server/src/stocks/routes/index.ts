import { SERVER_MODES } from '../../api/env';
import { allowedModes } from '../../api/middleware';
import { openAPIRouterFactory } from '../../api/open-api';
import { requireLoggedInSessionMiddleware } from '../../auth/middleware';
import searchHandler from '../handlers/search';
import searchRoute from './search';

const stocksApi = openAPIRouterFactory();

stocksApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

stocksApi
  // GET: /search
  .openapi(searchRoute, searchHandler);

export default stocksApi;
