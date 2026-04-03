import { SERVER_MODES } from '@/api/env';
import { allowedModes } from '@/api/middleware';
import { openAPIRouterFactory } from '@/api/open-api';
import { requireLoggedInSessionMiddleware } from '@/auth';
import createEntryRoute from './create-entry';
import listEntriesRoute from './list-entries';
import updateEntryRoute from './update-entry';
import createEntry from '../handlers/create-entry';
import listEntries from '../handlers/list-entries';
import updateEntry from '../handlers/update-entry';

const portfolioApi = openAPIRouterFactory();

portfolioApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

portfolioApi
  // GET: /entries
  .openapi(listEntriesRoute, listEntries)
  // POST: /entries
  .openapi(createEntryRoute, createEntry)
  // PUT: /entries/{entryId}
  .openapi(updateEntryRoute, updateEntry);

export default portfolioApi;
