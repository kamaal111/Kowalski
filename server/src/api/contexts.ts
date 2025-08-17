import type { Context, Next } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';

export type HonoVariables = RequestIdVariables;

export type HonoEnvironment = { Variables: HonoVariables };

export function injectRequestContext() {
  return async (_c: Context<HonoEnvironment>, next: Next) => {
    await next();
  };
}
