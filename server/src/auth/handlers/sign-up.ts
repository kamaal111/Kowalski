import { APP_API_BASE_PATH } from '../../constants/common';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';
import { logInfo } from '@/logging';
import { setRequestRoute, withRequestLogger } from '@/logging/http';
import { ROUTE_NAME } from '../constants';
import signUpRoute from '../routes/sign-up';
import { handleAuthRequest, getHeadersWithJwtAfterAuth } from '../utils/request';
import type { HonoContext } from '../../api/contexts';

const SIGN_UP_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${signUpRoute.path}` as const;

async function signUpHandler(c: HonoContext) {
  setRequestRoute(c, SIGN_UP_ROUTE_PATH);
  const status = STATUS_CODES.CREATED;
  const responseSchema = signUpRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, sessionToken } = await handleAuthRequest(c, { responseSchema });
  const headers = await getHeadersWithJwtAfterAuth(c, sessionToken);
  logInfo(withRequestLogger(c, { component: 'auth' }), {
    event: 'auth.sign_up.succeeded',
    route: SIGN_UP_ROUTE_PATH,
    outcome: 'success',
  });

  return c.json(jsonResponse, { status, headers });
}

export default signUpHandler;
