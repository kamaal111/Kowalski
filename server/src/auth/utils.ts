import type z from 'zod';

import type { HonoContext } from '../api/contexts.js';
import { makeNewRequest } from '../utils/request.js';
import { BetterAuthException } from './exceptions.js';
import type { BODY_TYPES } from '../constants/request.js';

function isBetterAuthException(response: unknown): response is { code: string; message: string } {
  return (
    response != null &&
    typeof response === 'object' &&
    'code' in response &&
    'message' in response &&
    typeof response.code === 'string' &&
    typeof response.message === 'string'
  );
}

export async function handleAuthRequest<Schema extends z.ZodType>(
  c: HonoContext,
  options: { bodyType?: typeof BODY_TYPES.JSON; responseSchema: Schema },
): Promise<{ jsonResponse: z.infer<Schema>; response: Response }> {
  const request = await makeNewRequest(c, options);
  const response = await c.get('auth').handler(request);
  const jsonResponse: unknown = await response.json();
  if (isBetterAuthException(jsonResponse)) {
    throw new BetterAuthException(c, {
      code: jsonResponse.code,
      message: jsonResponse.message,
      headers: response.headers,
    });
  }

  const validatedResponse = await options.responseSchema.parseAsync(jsonResponse);

  return { jsonResponse: validatedResponse, response };
}
