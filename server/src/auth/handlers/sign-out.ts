import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';
import { MIME_TYPES } from '../../constants/request.js';
import signOutRoute from '../routes/sign-out.js';
import { handleAuthRequest } from '../utils/request.js';

async function signOutHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signOutRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse } = await handleAuthRequest(c, { responseSchema });
  return c.json(jsonResponse, { status });
}

export default signOutHandler;
