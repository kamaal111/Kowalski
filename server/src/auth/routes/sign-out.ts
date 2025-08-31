import { createRoute } from '@hono/zod-openapi';

import { SignOutResponseSchema } from '../schemas/responses.js';

const signOutRoute = createRoute({
  method: 'post',
  path: '/sign-out',
  tags: ['Authentication'],
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
