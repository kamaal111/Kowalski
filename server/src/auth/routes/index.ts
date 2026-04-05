import { openAPIRouterFactory } from '../../api/open-api';

import signUpRoute from './sign-up';
import signInRoute from './sign-in';
import signOutRoute from './sign-out';
import sessionRoute from './session';
import tokenRoute from './token';
import preferencesRoute from './preferences';
import signInHandler from '../handlers/sign-in';
import signUpHandler from '../handlers/sign-up';
import signOutHandler from '../handlers/sign-out';
import sessionHandler from '../handlers/session';
import tokenHandler from '../handlers/token';
import preferencesHandler from '../handlers/preferences';
import jwksHandler from '../handlers/jwks';
import { allowedModes } from '../../api/middleware';
import { SERVER_MODES } from '../../api/env';
import { JWKS_PATH } from '../better-auth';

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

// PATCH: /preferences
authApi.openapi(preferencesRoute, preferencesHandler);

// Catch-all for any other better-auth endpoints
authApi.on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
