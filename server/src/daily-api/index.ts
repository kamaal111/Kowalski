import { Hono } from 'hono';

import type { HonoEnvironment } from '../api/contexts.js';
import { allowedModes } from '../api/middleware.js';
import { SERVER_MODES } from '../api/env.js';
import { NotFound } from '../api/exceptions.js';

const dailyApi = new Hono<HonoEnvironment>();

dailyApi.use(allowedModes(SERVER_MODES.DAILY));

dailyApi
  .post('/forex', c => {
    return c.json({}, 200);
  })
  .all('/*', c => {
    throw new NotFound(c);
  });

export default dailyApi;
