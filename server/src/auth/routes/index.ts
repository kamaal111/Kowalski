import { openAPIRouterFactory } from '../../api/open-api.js';
import signUpRoute from './sign-up.js';
import signInRoute from './sign-in.js';
import { STATUS_CODES } from '../../constants/http.js';
import signOutRoute from './sign-out.js';
import { handleAuthRequest } from '../utils.js';
import { BODY_TYPES, MIME_TYPES } from '../../constants/request.js';

const authApi = openAPIRouterFactory();

authApi
  // POST: /sign-up/email
  .openapi(signUpRoute, async c => {
    const status = STATUS_CODES.CREATED;
    const responseSchema = signUpRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
    const { jsonResponse, response } = await handleAuthRequest(c, { bodyType: BODY_TYPES.JSON, responseSchema });
    return c.json(jsonResponse, { status, headers: response.headers });
  })
  // POST: /sign-in/email
  .openapi(signInRoute, async c => {
    const status = STATUS_CODES.OK;
    const responseSchema = signInRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
    const { jsonResponse, response } = await handleAuthRequest(c, { bodyType: BODY_TYPES.JSON, responseSchema });
    return c.json(jsonResponse, { status, headers: response.headers });
  })
  // POST: /sign-out
  .openapi(signOutRoute, async c => {
    const status = STATUS_CODES.OK;
    const responseSchema = signOutRoute.responses[status].content[MIME_TYPES.APPLICATION_JSON].schema;
    const { jsonResponse, response } = await handleAuthRequest(c, { responseSchema });
    return c.json(jsonResponse, { status, headers: response.headers });
  })
  // Catch-all for any other better-auth endpoints that don't have explicit OpenAPI specs
  .on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
