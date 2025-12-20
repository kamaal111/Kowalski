import { SERVER_MODES } from '@/api/env.js';
import { allowedModes } from '@/api/middleware.js';
import { openAPIRouterFactory } from '@/api/open-api.js';
import { requireLoggedInSessionMiddleware } from '@/auth/index.js';
import createEntryRoute from './create-entry.js';
import createEntry from '../handlers/create-entry.js';

const portfolioApi = openAPIRouterFactory();

portfolioApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

portfolioApi
  // POST: /entry
  .openapi(createEntryRoute, createEntry);

export default portfolioApi;
