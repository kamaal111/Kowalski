import { openAPIRouterFactory } from '../../api/open-api.js';
import signUpRoute from './sign-up.js';
import signInRoute from './sign-in.js';
import signOutRoute from './sign-out.js';
import signInHandler from '../handlers/sign-in.js';
import signUpHandler from '../handlers/sign-up.js';
import signOutHandler from '../handlers/sign-out.js';

const authApi = openAPIRouterFactory();

authApi
  // POST: /sign-up/email
  .openapi(signUpRoute, signUpHandler)
  // POST: /sign-in/email
  .openapi(signInRoute, signInHandler)
  // POST: /sign-out
  .openapi(signOutRoute, signOutHandler)
  // Catch-all for any other better-auth endpoints that don't have explicit OpenAPI specs
  .on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
