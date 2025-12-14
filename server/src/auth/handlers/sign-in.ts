import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import { MIME_TYPES } from '../../constants/request.js';
import signInRoute from '../routes/sign-in.js';
import { handleAuthRequest, getHeadersWithJwtAfterAuth } from '../utils/request.js';

async function signInHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signInRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, sessionToken } = await handleAuthRequest(c, { responseSchema });
  const headers = await getHeadersWithJwtAfterAuth(c, sessionToken);

  return c.json(jsonResponse, { status, headers });
}

export default signInHandler;
