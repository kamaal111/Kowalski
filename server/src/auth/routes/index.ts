import { HTTPException } from 'hono/http-exception';

import { openAPIRouterFactory } from '../../api/open-api.js';
import signUpRoute from './sign-up.js';
import signInRoute from './sign-in.js';
import signOutRoute from './sign-out.js';
import sessionRoute from './session.js';
import signInHandler from '../handlers/sign-in.js';
import signUpHandler from '../handlers/sign-up.js';
import signOutHandler from '../handlers/sign-out.js';
import sessionHandler from '../handlers/session.js';
import { InvalidValidation } from '../../api/exceptions.js';
import { makeUncaughtErrorLog } from '../../middleware/logging.js';
import type { HonoContext } from '../../api/contexts.js';
import { STATUS_CODES } from '../../constants/http.js';

const authApi = openAPIRouterFactory();

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
  .on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw))
  .onError((err, c) => {
    if (err instanceof InvalidValidation) {
      return c.json({ message: err.message, validations: err.validationError.issues }, err.status);
    }

    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status);
    }

    makeUncaughtErrorLog(c as HonoContext, err);

    return c.json({ message: 'Something went wrong' }, STATUS_CODES.INTERNAL_SERVER_ERROR);
  });

export default authApi;
