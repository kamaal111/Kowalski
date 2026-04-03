import { createMiddleware } from 'hono/factory';
import type { HonoVariables } from './contexts';
import type { ServerMode } from './env';
import env, { SERVER_MODES } from './env';
import { NotFound } from './exceptions';

const { MODE } = env;

export function allowedModes(...modes: ServerMode[]) {
  return createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
    if (MODE !== SERVER_MODES.TEST && !modes.includes(MODE)) {
      throw new NotFound(c);
    }

    await next();
  });
}
