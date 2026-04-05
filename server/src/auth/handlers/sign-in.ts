import { APP_API_BASE_PATH } from '../../constants/common';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { ROUTE_NAME } from '../constants';
import signInRoute from '../routes/sign-in';
import { handleAuthRequest, getHeadersWithJwtAfterAuth } from '../utils/request';
import type { HonoContext } from '../../api/contexts';

const SIGN_IN_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${signInRoute.path}` as const;

async function signInHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signInRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, sessionToken } = await handleAuthRequest(c, { responseSchema });
  const headers = await getHeadersWithJwtAfterAuth(c, sessionToken);
  logInfo(withRequestLogger(c, { component: 'auth' }), {
    event: 'auth.sign_in.succeeded',
    route: SIGN_IN_ROUTE_PATH,
    outcome: 'success',
  });

  return c.json(jsonResponse, { status, headers });
}

export default signInHandler;
