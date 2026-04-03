import type { Env, Schema } from 'hono';
import type { BlankSchema } from 'hono/types';
import { $, OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import * as z from 'zod';
import yaml from 'js-yaml';

import type { HonoEnvironment } from './contexts';
import { InvalidValidation } from './exceptions';
import { STATUS_CODES } from '../constants/http';
import { handleServerError } from '@/middleware/logging';

export type OpenAPIRouter = OpenAPIHono<HonoEnvironment>;

const SPEC_NAME = '/spec';
const SPEC_SOURCE_OF_TRUTH_URL = `${SPEC_NAME}.json`;
const OPENAPI_INFO = {
  openapi: '3.1.1',
  info: { version: '1.0.0', title: 'Kowalski API' },
  servers: [{ url: 'http://127.0.0.1:8080' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

const OpenAPIInfoSchema = z.object({
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

const OpenAPIComponentsSchema = z
  .object({
    schemas: z.record(z.string(), z.object().loose()).optional(),
    securitySchemes: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()
  .transform(components => ({
    ...components,
    securitySchemes: components.securitySchemes ?? OPENAPI_INFO.components.securitySchemes,
  }));

const OpenAPISpecSchema = z
  .object({
    openapi: z.string(),
    info: OpenAPIInfoSchema,
    paths: z.record(z.string(), z.record(z.string(), z.unknown())),
    components: OpenAPIComponentsSchema,
  })
  .loose();

export function openAPIRouterFactory(): OpenAPIHono<HonoEnvironment, BlankSchema, '/'> {
  const router = new OpenAPIHono<HonoEnvironment>({
    defaultHook: (result, c) => {
      if (!result.success) {
        throw new InvalidValidation(c, result.error);
      }
    },
  });

  router.onError(handleServerError);

  return router;
}

export function withOpenAPIDocumentation<
  E extends Env = Env,
  S extends Schema = BlankSchema,
  BasePath extends string = '/',
>(app: OpenAPIHono<E, S, BasePath>) {
  const documentedApp = app.doc(SPEC_SOURCE_OF_TRUTH_URL, OPENAPI_INFO);
  const appWithYamlSpec = withYamlSpec(documentedApp, { url: SPEC_SOURCE_OF_TRUTH_URL });

  return $(appWithYamlSpec.get('/doc', swaggerUI({ url: SPEC_SOURCE_OF_TRUTH_URL })));
}

function withYamlSpec<E extends Env = Env, S extends Schema = BlankSchema, BasePath extends string = '/'>(
  app: OpenAPIHono<E, S, BasePath>,
  options: { url: string },
) {
  return $(
    app.get(`${SPEC_NAME}.yaml`, async c => {
      const origin = new URL(c.req.url).origin;
      const requestInit = new Request(`${origin}${options.url}`, {
        headers: { Accept: 'application/json' },
      });
      const response = await app.request(requestInit);
      const rawData: unknown = await response.json();
      const spec = OpenAPISpecSchema.parse(rawData);
      const transformedSpec = transformNullableToUnion(spec);
      const formattedSpec = yaml.dump(transformedSpec, { indent: 2 });

      return c.text(formattedSpec, STATUS_CODES.OK, { 'Content-Type': 'text/yaml' });
    }),
  );
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
