import { Hono } from 'hono';
import type { HonoEnvironment } from '../api/contexts';
import { allowedModes } from '../api/middleware';
import { SERVER_MODES } from '../api/env';
import { FOREX_ROUTE_NAME, forexApi } from '../forex';
import { handleServerError } from '@/middleware/logging';

const dailyApi = new Hono<HonoEnvironment>();

dailyApi.onError(handleServerError).use(allowedModes(SERVER_MODES.DAILY));

dailyApi.route(FOREX_ROUTE_NAME, forexApi);

export default dailyApi;
