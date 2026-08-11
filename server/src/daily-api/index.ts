import { Hono } from 'hono';
import type { HonoEnvironment } from '../api/contexts.ts';
import { allowedModes } from '../api/middleware.ts';
import { SERVER_MODES } from '../api/env.ts';
import { FOREX_ROUTE_NAME, forexApi } from '../forex/index.ts';
import { handleServerError } from '../middleware/logging.ts';

const dailyApi = new Hono<HonoEnvironment>();

dailyApi.onError(handleServerError).use(allowedModes(SERVER_MODES.DAILY));

dailyApi.route(FOREX_ROUTE_NAME, forexApi);

export default dailyApi;
