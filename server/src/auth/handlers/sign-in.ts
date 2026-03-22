import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';
import signInRoute from '../routes/sign-in';
import { handleAuthRequest, getHeadersWithJwtAfterAuth } from '../utils/request';

async function signInHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signInRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, sessionToken } = await handleAuthRequest(c, { responseSchema });
  const headers = await getHeadersWithJwtAfterAuth(c, sessionToken);

  return c.json(jsonResponse, { status, headers });
}

export default signInHandler;
