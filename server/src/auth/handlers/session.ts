import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import { SessionNotFound } from '../exceptions.js';
import type { SessionResponse } from '../schemas/responses.js';

async function sessionHandler(c: HonoContext) {
  const sessionResponse = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!sessionResponse) {
    throw new SessionNotFound(c);
  }

  const response: SessionResponse = {
    session: {
      expires_at: sessionResponse.session.expiresAt.toISOString(),
      created_at: sessionResponse.session.createdAt.toISOString(),
      updated_at: sessionResponse.session.updatedAt.toISOString(),
    },
    user: {
      name: sessionResponse.user.name,
      email: sessionResponse.user.email,
      email_verified: sessionResponse.user.emailVerified,
      created_at: sessionResponse.user.createdAt.toISOString(),
    },
  };

  return c.json(response, { status: STATUS_CODES.OK });
}

export default sessionHandler;
