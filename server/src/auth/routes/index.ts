import { openAPIRouterFactory } from '../../api/open-api.js';

import signUpRoute from './sign-up.js';
import signInRoute from './sign-in.js';
import signOutRoute from './sign-out.js';
import sessionRoute from './session.js';
import tokenRoute from './token.js';
import signInHandler from '../handlers/sign-in.js';
import signUpHandler from '../handlers/sign-up.js';
import signOutHandler from '../handlers/sign-out.js';
import sessionHandler from '../handlers/session.js';
import tokenHandler from '../handlers/token.js';
import jwksHandler from '../handlers/jwks.js';
import { allowedModes } from '../../api/middleware.js';
import { SERVER_MODES } from '../../api/env.js';
import { JWKS_PATH } from '../better-auth.js';

const authApi = openAPIRouterFactory();

authApi.use(allowedModes(SERVER_MODES.SERVER));

// GET: /jwks
authApi.get(JWKS_PATH, jwksHandler);

// POST: /sign-up/email
authApi.openapi(signUpRoute, signUpHandler);

// POST: /sign-in/email
authApi.openapi(signInRoute, signInHandler);

// POST: /sign-out
authApi.openapi(signOutRoute, signOutHandler);

// GET: /session
authApi.openapi(sessionRoute, sessionHandler);

// GET: /token (JWT token refresh)
authApi.openapi(tokenRoute, tokenHandler);

// Catch-all for any other better-auth endpoints
authApi.on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
