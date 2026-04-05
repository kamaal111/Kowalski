import { APP_API_BASE_PATH } from '../../constants/common';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import { ROUTE_NAME } from '../constants';
import signOutRoute from '../routes/sign-out';
import { handleAuthRequest } from '../utils/request';
import type { HonoContext } from '../../api/contexts';

const SIGN_OUT_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${signOutRoute.path}` as const;

async function signOutHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signOutRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse } = await handleAuthRequest(c, { responseSchema });
  logInfo(withRequestLogger(c, { component: 'auth' }), {
    event: 'auth.sign_out.succeeded',
    route: SIGN_OUT_ROUTE_PATH,
    outcome: 'success',
  });
  return c.json(jsonResponse, { status });
}

export default signOutHandler;
