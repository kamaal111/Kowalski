import { asserts } from '@kamaalio/kamaal';
import type { HonoContext } from '../../api/contexts';
import { APP_API_BASE_PATH } from '../../constants/common';
import { STATUS_CODES } from '../../constants/http';
import { setRequestRoute, setRequestUserId } from '@/logging/http';
import { ROUTE_NAME } from '../constants';
import sessionRoute from '../routes/session';

const SESSION_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${sessionRoute.path}` as const;

function sessionHandler(c: HonoContext) {
  const session = c.get('session');
  asserts.invariant(session != null);
  setRequestRoute(c, SESSION_ROUTE_PATH);
  setRequestUserId(c, session.user.id);

  return c.json(session, { status: STATUS_CODES.OK });
}

export default sessionHandler;
