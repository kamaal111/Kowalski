import type { Env, Hono, Schema } from 'hono';
import type { BlankSchema } from 'hono/types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import * as z from 'zod';
import yaml from 'js-yaml';

import type { HonoContext, HonoEnvironment } from './contexts.js';
import { InvalidValidation } from './exceptions.js';
import { STATUS_CODES } from '../constants/http.js';

export type OpenAPIRouter = OpenAPIHono<HonoEnvironment>;

const SPEC_NAME = '/spec';
const SPEC_SOURCE_OF_TRUTH_URL = `${SPEC_NAME}.json`;
const OPENAPI_INFO = {
  openapi: '3.1.1',
  info: { version: '1.0.0', title: 'Kowalski API' },
  servers: [{ url: 'http://127.0.0.1:8080' }],
};

const OpenAPIInfoSchema = z.object({
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

const OpenAPISpecSchema = z
  .object({
    openapi: z.string(),
    info: OpenAPIInfoSchema,
    paths: z.record(z.string(), z.record(z.string(), z.unknown())),
    components: z.object({ schemas: z.record(z.string(), z.object().loose()) }).loose(),
  })
  .loose();

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
  (app as OpenAPIHono<E, S, BasePath>).doc(SPEC_SOURCE_OF_TRUTH_URL, OPENAPI_INFO);
  withYamlSpec(app, { url: SPEC_SOURCE_OF_TRUTH_URL });
  app.get('/doc', swaggerUI({ url: SPEC_SOURCE_OF_TRUTH_URL }));

  return app;
}

function withYamlSpec<E extends Env = Env, S extends Schema = BlankSchema, BasePath extends string = '/'>(
  app: Hono<E, S, BasePath>,
  options: { url: string },
) {
  return app.get(`${SPEC_NAME}.yaml`, async c => {
    const origin = new URL(c.req.url).origin;
    const requestInit = new Request(`${origin}${options.url}`, {
      headers: { Accept: 'application/json' },
    });
    const response = await app.request(requestInit);
    const rawData: unknown = await response.json();
    const spec = await OpenAPISpecSchema.parseAsync(rawData);
    const transformedSpec = transformNullableToUnion(spec);
    const formattedSpec = yaml.dump(transformedSpec, { indent: 2 });

    return c.text(formattedSpec, STATUS_CODES.OK, { 'Content-Type': 'text/yaml' });
  });
}

function transformNullableToUnion(obj: unknown): unknown {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(transformNullableToUnion);
  if (typeof obj !== 'object') return obj;
  return transformDefiniteObjectNullableToUnion(obj);
}

function transformDefiniteObjectNullableToUnion(obj: object): object {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const entryIsInvalidNullable =
      key === 'type' && typeof value === 'string' && 'nullable' in obj && obj.nullable === true;
    if (entryIsInvalidNullable) return { ...acc, type: [null, value] };

    const keyIsNullable = key === 'nullable';
    const shouldFilterOut = keyIsNullable;
    if (shouldFilterOut) return acc;

    return { ...acc, [key]: transformNullableToUnion(value) };
  }, {});
}
