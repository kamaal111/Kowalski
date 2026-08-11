import { SERVER_MODES } from '../../api/env.ts';
import { allowedModes } from '../../api/middleware.ts';
import { openAPIRouterFactory } from '../../api/open-api.ts';
import { requireLoggedInSessionMiddleware } from '../../auth/index.ts';
import createEntryRoute from './create-entry.ts';
import bulkCreateEntriesRoute from './bulk-create-entries.ts';
import dashboardsRoute from './dashboards.ts';
import overviewPreflightRoute from './overview-preflight.ts';
import overviewRoute from './overview.ts';
import updateEntryRoute from './update-entry.ts';
import bulkCreateEntries from '../handlers/bulk-create-entries.ts';
import createEntry from '../handlers/create-entry.ts';
import dashboards from '../handlers/dashboards.ts';
import overviewPreflight from '../handlers/overview-preflight.ts';
import overview from '../handlers/overview.ts';
import updateEntry from '../handlers/update-entry.ts';

const portfolioApi = openAPIRouterFactory();

portfolioApi.use(allowedModes(SERVER_MODES.SERVER)).use(requireLoggedInSessionMiddleware);

portfolioApi
  // GET: /dashboards
  .openapi(dashboardsRoute, dashboards)
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
