import { createMiddleware } from 'hono/factory';

import type { HonoContext, HonoVariables } from '../api/contexts.js';
import { toISO8601String } from '../utils/strings.js';
import { SessionNotFound } from './exceptions.js';
import type { SessionResponse } from './schemas/responses.js';

export const requireLoggedInSessionMiddleware = createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
  const sessionResponse = await getUserSession(c);

  c.set('session', sessionResponse);
  await next();
});

async function getUserSession(c: HonoContext): Promise<SessionResponse> {
  const sessionResponse = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!sessionResponse) {
    throw new SessionNotFound(c);
  }

  const response: SessionResponse = {
    session: {
      expires_at: toISO8601String(sessionResponse.session.expiresAt),
      created_at: toISO8601String(sessionResponse.session.createdAt),
      updated_at: toISO8601String(sessionResponse.session.updatedAt),
    },
    user: {
      name: sessionResponse.user.name,
      email: sessionResponse.user.email,
      email_verified: sessionResponse.user.emailVerified,
      created_at: toISO8601String(sessionResponse.user.createdAt),
    },
  };

  return response;
}
