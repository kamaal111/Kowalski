import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';
import { MIME_TYPES } from '../../constants/request';
import signUpRoute from '../routes/sign-up';
import { handleAuthRequest, getHeadersWithJwtAfterAuth } from '../utils/request';

async function signUpHandler(c: HonoContext) {
  const status = STATUS_CODES.CREATED;
  const responseSchema = signUpRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, sessionToken } = await handleAuthRequest(c, { responseSchema });
  const headers = await getHeadersWithJwtAfterAuth(c, sessionToken);

  return c.json(jsonResponse, { status, headers });
}

export default signUpHandler;
