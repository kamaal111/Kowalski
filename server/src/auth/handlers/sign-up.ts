import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import { BODY_TYPES, MIME_TYPES } from '../../constants/request.js';
import signUpRoute from '../routes/sign-up.js';
import { handleAuthRequest } from '../utils.js';

async function signUpHandler(c: HonoContext) {
  const status = STATUS_CODES.CREATED;
  const responseSchema = signUpRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, response } = await handleAuthRequest(c, { bodyType: BODY_TYPES.JSON, responseSchema });
  return c.json(jsonResponse, { status, headers: response.headers });
}

export default signUpHandler;
