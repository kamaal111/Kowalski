import { SERVER_MODES } from '@/api/env';
import { allowedModes } from '@/api/middleware';
import { openAPIRouterFactory } from '@/api/open-api';
import { requireLoggedInSessionMiddleware } from '@/auth';
import createEntryRoute from './create-entry';
import bulkCreateEntriesRoute from './bulk-create-entries';
import holdingsPreflightRoute from './holdings-preflight';
import holdingsRoute from './holdings';
import listEntriesRoute from './list-entries';
import overviewRoute from './overview';
import updateEntryRoute from './update-entry';
import bulkCreateEntries from '../handlers/bulk-create-entries';
import createEntry from '../handlers/create-entry';
import holdingsPreflight from '../handlers/holdings-preflight';
import holdings from '../handlers/holdings';
import listEntries from '../handlers/list-entries';
import overview from '../handlers/overview';
import updateEntry from '../handlers/update-entry';

const portfolioApi = openAPIRouterFactory();

portfolioApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

portfolioApi
  // GET: /entries
  .openapi(listEntriesRoute, listEntries)
  // GET: /overview
  .openapi(overviewRoute, overview)
  // GET: /holdings
  .openapi(holdingsRoute, holdings)
  // GET: /holdings/preflight
  .openapi(holdingsPreflightRoute, holdingsPreflight)
  // POST: /entries
  .openapi(createEntryRoute, createEntry)
  // POST: /entries/bulk
  .openapi(bulkCreateEntriesRoute, bulkCreateEntries)
  // PUT: /entries/{entryId}
  .openapi(updateEntryRoute, updateEntry);

export default portfolioApi;
