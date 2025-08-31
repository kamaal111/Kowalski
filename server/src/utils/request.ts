import type { HonoContext } from '../api/contexts.js';

export type BodyType = (typeof BODY_TYPES)[keyof typeof BODY_TYPES];

export const BODY_TYPES = { JSON: 'json' } as const;

const BODY_TO_STRING_TRANSFORMERS: Record<BodyType, (rawBody: unknown) => string> = {
  [BODY_TYPES.JSON]: rawBody => JSON.stringify(rawBody),
};

export async function makeNewRequest(c: HonoContext, options?: { bodyType?: BodyType }): Promise<Request> {
  let body: string | undefined = undefined;
  const bodyType = options?.bodyType;
  if (bodyType != null) {
    const rawBody: unknown = await c.req[bodyType]();
    body = BODY_TO_STRING_TRANSFORMERS[bodyType](rawBody);
  }
  const requestInit: RequestInit = { method: c.req.method, headers: c.req.header(), body };

  return new Request(c.req.url, requestInit);
}
