import { SERVER_MODES } from '@/api/env';
import { allowedModes } from '@/api/middleware';
import { openAPIRouterFactory } from '@/api/open-api';
import { requireLoggedInSessionMiddleware } from '@/auth';
import createEntryRoute from './create-entry';
import createEntry from '../handlers/create-entry';

const portfolioApi = openAPIRouterFactory();

portfolioApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

portfolioApi
  // POST: /entries
  .openapi(createEntryRoute, createEntry);

export default portfolioApi;
