import { Hono } from 'hono';

import type { HonoEnvironment } from '../api/contexts.js';
import { allowedModes } from '../api/middleware.js';
import { SERVER_MODES } from '../api/env.js';
import { FOREX_ROUTE_NAME, forexApi } from '../forex/index.js';

const dailyApi = new Hono<HonoEnvironment>();

dailyApi.use(allowedModes(SERVER_MODES.DAILY));

dailyApi.route(FOREX_ROUTE_NAME, forexApi);

export default dailyApi;
