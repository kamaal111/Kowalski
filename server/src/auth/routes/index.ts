import { openAPIRouterFactory } from '../../api/open-api.js';
import signUpRoute from './sign-up.js';
import signInRoute from './sign-in.js';
import signOutRoute from './sign-out.js';
import sessionRoute from './session.js';
import signInHandler from '../handlers/sign-in.js';
import signUpHandler from '../handlers/sign-up.js';
import signOutHandler from '../handlers/sign-out.js';
import sessionHandler from '../handlers/session.js';
import { allowedModes } from '../../api/middleware.js';
import { SERVER_MODES } from '../../api/env.js';

const authApi = openAPIRouterFactory();

authApi.use(allowedModes(SERVER_MODES.SERVER));

authApi
  // POST: /sign-up/email
  .openapi(signUpRoute, signUpHandler)
  // POST: /sign-in/email
  .openapi(signInRoute, signInHandler)
  // POST: /sign-out
  .openapi(signOutRoute, signOutHandler)
  // GET: /session
  .openapi(sessionRoute, sessionHandler)
  // Catch-all for any other better-auth endpoints that don't have explicit OpenAPI specs
  .on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
