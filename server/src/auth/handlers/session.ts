import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';
import { getSessionWhereSessionIsRequired } from '../utils/session';

function sessionHandler(c: HonoContext) {
  const session = getSessionWhereSessionIsRequired(c);

  return c.json(session, { status: STATUS_CODES.OK });
}

export default sessionHandler;
