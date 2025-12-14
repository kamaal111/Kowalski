import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import { makeNewRequest } from '../../utils/request.js';
import { parseTokenResponseAndCreateHeaders } from '../utils/request.js';
import { SessionNotFound } from '../exceptions.js';

async function tokenHandler(c: HonoContext) {
  const request = await makeNewRequest(c);
  const response = await c.get('auth').handler(request);
  if (!response.ok) {
    throw new SessionNotFound(c);
  }

  const authHeader = c.req.header('authorization');
  const sessionToken = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  const { token, headers } = await parseTokenResponseAndCreateHeaders(response, sessionToken);

  return c.json({ token }, { status: STATUS_CODES.OK, headers });
}

export default tokenHandler;
