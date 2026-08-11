import { createMiddleware } from 'hono/factory';
import type { HonoVariables } from './contexts.ts';
import type { ServerMode } from './env.ts';
import env, { SERVER_MODES } from './env.ts';
import { NotFound } from './exceptions.ts';

const { MODE } = env;

export function allowedModes(...modes: ServerMode[]) {
  return createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
    if (MODE !== SERVER_MODES.TEST && !modes.includes(MODE)) {
      throw new NotFound(c);
    }

    await next();
  });
}
