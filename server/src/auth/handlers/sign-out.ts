import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';
import signOutRoute from '../routes/sign-out';
import { handleAuthRequest } from '../utils/request';

async function signOutHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signOutRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse } = await handleAuthRequest(c, { responseSchema });
  return c.json(jsonResponse, { status });
}

export default signOutHandler;
