import type { HonoContext } from '../../api/contexts.js';
import { APIException } from '../../api/exceptions.js';
import { STATUS_CODES } from '../../constants/http.js';
import { BODY_TYPES, MIME_TYPES } from '../../constants/request.js';
import { getValueFromSetCookie } from '../../utils/request.js';
import signInRoute from '../routes/sign-in.js';
import { handleAuthRequest } from '../utils.js';

async function signInHandler(c: HonoContext) {
  const status = STATUS_CODES.OK;
  const responseSchema = signInRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
  const { jsonResponse, response } = await handleAuthRequest(c, { bodyType: BODY_TYPES.JSON, responseSchema });
  const maxAgeValue = getValueFromSetCookie(response.headers, 'Max-Age');
  if (!maxAgeValue) {
    throw new APIException(c, STATUS_CODES.INTERNAL_SERVER_ERROR, {
      message: 'Failed to retrieve authentication token expiry',
      code: 'MISSING_TOKEN_EXPIRY',
    });
  }

  const maxAgeNumber = Number(maxAgeValue);
  if (Number.isNaN(maxAgeNumber)) {
    throw new APIException(c, STATUS_CODES.INTERNAL_SERVER_ERROR, {
      message: 'Invalid authentication token expiry format',
      code: 'INVALID_TOKEN_EXPIRY',
    });
  }

  const headers = new Headers(response.headers);
  headers.set('set-auth-token-expiry', maxAgeNumber.toString());

  return c.json(jsonResponse, { status, headers });
}

export default signInHandler;
