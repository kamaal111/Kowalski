import { createMiddleware } from 'hono/factory';

import env, { type ServerMode } from './env.js';
import { NotFound } from './exceptions.js';
import type { HonoVariables } from './contexts.js';

const { MODE } = env;

export function allowedModes(...modes: ServerMode[]) {
  return createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
    if (!modes.includes(MODE)) {
      throw new NotFound(c);
    }

    await next();
  });
}
