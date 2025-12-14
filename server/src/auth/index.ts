export { auth, createAuth } from './better-auth.js';
export { default as authApi } from './routes/index.js';
export type { SessionResponse } from './schemas/responses.js';
export type { Auth } from './better-auth.js';
export { requireLoggedInSessionMiddleware } from './middleware.js';
export { ROUTE_NAME as AUTH_ROUTE_NAME } from './constants.js';
