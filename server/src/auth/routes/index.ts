import { openAPIRouterFactory } from '../../api/open-api.js';
import signUpRoute from './sign-up.js';
import { AuthResponseSchema, SignOutResponseSchema } from '../schemas/responses.js';
import signInRoute from './sign-in.js';
import { STATUS_CODES } from '../../constants/http.js';
import signOutRoute from './sign-out.js';
import { handleAuthRequest } from '../utils.js';
import { BODY_TYPES } from '../../utils/request.js';

const authApi = openAPIRouterFactory();

authApi
  // POST: /sign-in/email
  .openapi(signInRoute, async c => {
    const response = await handleAuthRequest(c, { bodyType: BODY_TYPES.JSON, responseSchema: AuthResponseSchema });
    return c.json(response, STATUS_CODES.OK);
  })
  // POST: /sign-up/email
  .openapi(signUpRoute, async c => {
    const response = await handleAuthRequest(c, { bodyType: BODY_TYPES.JSON, responseSchema: AuthResponseSchema });
    return c.json(response, STATUS_CODES.CREATED);
  })
  // POST: /sign-out
  .openapi(signOutRoute, async c => {
    const response = await handleAuthRequest(c, { responseSchema: SignOutResponseSchema });
    return c.json(response, STATUS_CODES.OK);
  })
  // Catch-all for any other better-auth endpoints that don't have explicit OpenAPI specs
  .on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
