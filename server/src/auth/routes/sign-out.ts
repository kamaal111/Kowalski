import { createRoute } from '@hono/zod-openapi';

import { SignOutResponseSchema } from '../schemas/responses.js';
import { OPENAPI_TAG } from '../constants.js';

const signOutRoute = createRoute({
  method: 'post',
  path: '/sign-out',
  tags: [OPENAPI_TAG],
  summary: 'Sign out',
  description: 'Sign out the current user and invalidate the session',
  responses: {
    200: {
      description: 'Sign out successful',
      content: {
        'application/json': {
          schema: SignOutResponseSchema,
        },
      },
    },
  },
});

export default signOutRoute;
