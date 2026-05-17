import { SERVER_MODES } from '@/api/env';
import { allowedModes } from '@/api/middleware';
import { openAPIRouterFactory } from '@/api/open-api';
import { requireLoggedInSessionMiddleware } from '@/auth';
import createEntryRoute from './create-entry';
import bulkCreateEntriesRoute from './bulk-create-entries';
import overviewPreflightRoute from './overview-preflight';
import overviewRoute from './overview';
import updateEntryRoute from './update-entry';
import bulkCreateEntries from '../handlers/bulk-create-entries';
import createEntry from '../handlers/create-entry';
import overviewPreflight from '../handlers/overview-preflight';
import overview from '../handlers/overview';
import updateEntry from '../handlers/update-entry';

const portfolioApi = openAPIRouterFactory();

portfolioApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

portfolioApi
  // GET: /overview
  .openapi(overviewRoute, overview)
  // GET: /overview/preflight
  .openapi(overviewPreflightRoute, overviewPreflight)
  // POST: /entries
  .openapi(createEntryRoute, createEntry)
  // POST: /entries/bulk
  .openapi(bulkCreateEntriesRoute, bulkCreateEntries)
  // PUT: /entries/{entryId}
  .openapi(updateEntryRoute, updateEntry);

export default portfolioApi;
