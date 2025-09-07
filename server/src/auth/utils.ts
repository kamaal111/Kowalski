import z from 'zod';

import type { HonoContext } from '../api/contexts.js';
import { makeNewRequest } from '../utils/request.js';
import { BetterAuthException } from './exceptions.js';
import type { BODY_TYPES } from '../constants/request.js';

const BetterAuthExceptionSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export async function handleAuthRequest<Schema extends z.ZodType>(
  c: HonoContext,
  options: { bodyType?: typeof BODY_TYPES.JSON; responseSchema: Schema },
): Promise<{ jsonResponse: z.infer<Schema>; response: Response }> {
  const request = await makeNewRequest(c, options);
  const response = await c.get('auth').handler(request);
  const jsonResponse: unknown = await response.json();
  const exceptionResult = await BetterAuthExceptionSchema.safeParseAsync(jsonResponse);
  if (exceptionResult.success) {
    throw new BetterAuthException(c, {
      code: exceptionResult.data.code,
      message: exceptionResult.data.message,
      headers: response.headers,
    });
  }

  const validatedResponse = await options.responseSchema.parseAsync(jsonResponse);

  return { jsonResponse: validatedResponse, response };
}
