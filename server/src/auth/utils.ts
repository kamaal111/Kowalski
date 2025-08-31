import type z from 'zod';

import type { HonoContext } from '../api/contexts.js';
import { BODY_TYPES, makeNewRequest } from '../utils/request.js';

export async function handleAuthRequest<Schema extends z.ZodType>(
  c: HonoContext,
  options: { bodyType?: typeof BODY_TYPES.JSON; responseSchema: Schema },
): Promise<z.infer<Schema>> {
  const request = await makeNewRequest(c, options);
  const response = await c.get('auth').handler(request);
  const jsonResponse: unknown = await response.json();

  return options.responseSchema.parseAsync(jsonResponse);
}
