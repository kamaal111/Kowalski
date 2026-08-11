export { auth, createAuth } from './better-auth.ts';
export {
  authModule,
  getSessionWhereSessionIsRequired,
  requireSessionMiddleware as requireLoggedInSessionMiddleware,
  SessionResponseSchema,
} from './module.ts';
export type { SessionResponse } from './module.ts';
export type { Auth } from './better-auth.ts';
export { ROUTE_NAME as AUTH_ROUTE_NAME } from './constants.ts';
