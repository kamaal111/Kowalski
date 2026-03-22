import { asserts } from '@kamaalio/kamaal';

import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';

function sessionHandler(c: HonoContext) {
  const session = c.get('session');
  asserts.invariant(session != null);

  return c.json(session, { status: STATUS_CODES.OK });
}

export default sessionHandler;
