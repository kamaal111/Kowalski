import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import { MIME_TYPES } from '../../constants/request.js';
import signUpRoute from '../routes/sign-up.js';
import { handleAuthRequest, headersWithAuthExpiry } from '../utils/request.js';

async function signUpHandler(c: HonoContext) {
  const status = STATUS_CODES.CREATED;
  const responseSchema = signUpRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, response } = await handleAuthRequest(c, { responseSchema });
  const headers = headersWithAuthExpiry(c, response);

  return c.json(jsonResponse, { status, headers });
}

export default signUpHandler;
