import type { Env, Hono, Schema } from 'hono';
import type { BlankSchema } from 'hono/types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';

import type { HonoContext, HonoEnvironment } from './contexts.js';
import { InvalidValidation } from './exceptions.js';

export type OpenAPIRouter = OpenAPIHono<HonoEnvironment>;

export function openAPIRouterFactory() {
  return new OpenAPIHono<HonoEnvironment>({
    defaultHook: (result, c) => {
      if (!result.success) {
        throw new InvalidValidation(c as HonoContext, result.error);
      }
    },
  });
}

export function withOpenAPIDocumentation<
  E extends Env = Env,
  S extends Schema = BlankSchema,
  BasePath extends string = '/',
>(app: Hono<E, S, BasePath>) {
  return (app as OpenAPIHono<E, S, BasePath>)
    .doc('/spec.json', {
      openapi: '3.1.0',
      info: { version: '1.0.0', title: 'Kowalski API' },
      servers: [{ url: 'http://127.0.0.1:8080' }],
    })
    .get('/doc', swaggerUI({ url: '/spec.json' }));
}
