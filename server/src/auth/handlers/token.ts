import { APP_API_BASE_PATH } from '../../constants/common';
import { STATUS_CODES } from '../../constants/http';
import { logInfo } from '@/logging';
import { setRequestRoute, withRequestLogger } from '@/logging/http';
import { ROUTE_NAME } from '../constants';
import { SessionNotFound } from '../exceptions';
import tokenRoute from '../routes/token';
import { makeNewRequest } from '../../utils/request';
import { parseTokenResponseAndCreateHeaders } from '../utils/request';
import type { HonoContext } from '../../api/contexts';

const TOKEN_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${tokenRoute.path}` as const;

async function tokenHandler(c: HonoContext) {
  setRequestRoute(c, TOKEN_ROUTE_PATH);
  const request = await makeNewRequest(c);
  const response = await c.get('auth').handler(request);
  if (!response.ok) {
    throw new SessionNotFound(c);
  }

  const authHeader = c.req.header('authorization');
  const sessionToken = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  const { token, headers } = await parseTokenResponseAndCreateHeaders(response, sessionToken);
  logInfo(withRequestLogger(c, { component: 'auth' }), {
    event: 'auth.token.issued',
    route: TOKEN_ROUTE_PATH,
    outcome: 'success',
  });

  return c.json({ token }, { status: STATUS_CODES.OK, headers });
}

export default tokenHandler;
