import type { TypedResponse } from 'hono';

import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';
import { getSessionWhereSessionIsRequired } from '../utils/session';
import { SessionResponseSchema, type SessionResponse } from '../schemas/responses';

function sessionHandler(c: HonoContext): TypedResponse<SessionResponse, typeof STATUS_CODES.OK> {
  const session = getSessionWhereSessionIsRequired(c);

  return c.json(SessionResponseSchema.parse(session), { status: STATUS_CODES.OK });
}

export default sessionHandler;
