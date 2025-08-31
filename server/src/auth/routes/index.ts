import { openAPIRouterFactory } from '../../api/open-api.js';
import signUpRoute from './sign-up.js';
import { AuthResponseSchema, SignOutResponseSchema } from '../schemas/responses.js';
import signInRoute from './sign-in.js';
import { STATUS_CODES } from '../../constants/http.js';
import signOutRoute from './sign-out.js';

const authApi = openAPIRouterFactory();

authApi
  // POST: /sign-in/email
  .openapi(signInRoute, async c => {
    const response = await c.get('auth').handler(c.req.raw);
    const jsonResponse: unknown = await response.json();
    const validatedResponse = await AuthResponseSchema.parseAsync(jsonResponse);
    return c.json(validatedResponse, STATUS_CODES.OK);
  })
  // POST: /sign-up/email
  .openapi(signUpRoute, async c => {
    console.log('🐸🐸🐸 START', c.req);
    const response = await c.get('auth').handler(c.req.raw);
    console.log('🐸🐸🐸 GEN');
    console.log('🐸🐸🐸 response', response);
    const jsonResponse: unknown = await response.json();
    const validatedResponse = await AuthResponseSchema.parseAsync(jsonResponse);
    return c.json(validatedResponse, STATUS_CODES.CREATED);
  })
  // POST: /sign-out
  .openapi(signOutRoute, async c => {
    const response = await c.get('auth').handler(c.req.raw);
    const jsonResponse: unknown = await response.json();
    const validatedResponse = await SignOutResponseSchema.parseAsync(jsonResponse);
    return c.json(validatedResponse, STATUS_CODES.OK);
  })
  // Catch-all for any other better-auth endpoints that don't have explicit OpenAPI specs
  .on(['POST', 'GET'], '**', c => c.get('auth').handler(c.req.raw));

export default authApi;
