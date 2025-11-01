import z from 'zod';

import type { HonoContext } from '../../api/contexts.js';
import { getValueFromSetCookie, makeNewRequest } from '../../utils/request.js';
import { BetterAuthException } from '../exceptions.js';
import { APIException } from '../../api/exceptions.js';
import { STATUS_CODES } from '../../constants/http.js';
import { errorLogger } from '../../middleware/logging.js';

const BetterAuthExceptionSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export async function handleAuthRequest<Schema extends z.ZodType>(
  c: HonoContext,
  options: { responseSchema: Schema },
): Promise<{ jsonResponse: z.infer<Schema>; response: Response }> {
  const request = await makeNewRequest(c);
  const response = await c.get('auth').handler(request);
  const jsonResponse: unknown = await response.json();
  const exceptionResult = await BetterAuthExceptionSchema.safeParseAsync(jsonResponse);
  if (exceptionResult.success) {
    errorLogger(c, `better-auth error -> ${JSON.stringify(exceptionResult.data)}`);

    throw new BetterAuthException(c, {
      code: exceptionResult.data.code,
      message: exceptionResult.data.message,
      headers: response.headers,
    });
  }

  const validatedResponse = await options.responseSchema.parseAsync(jsonResponse);

  return { jsonResponse: validatedResponse, response };
}

export function headersWithAuthExpiry(c: HonoContext, response: Response): Headers {
  const maxAgeValue = getValueFromSetCookie(response.headers, 'Max-Age');
  if (!maxAgeValue) {
    throw new APIException(c, STATUS_CODES.INTERNAL_SERVER_ERROR, {
      message: 'Failed to retrieve authentication token expiry',
      code: 'MISSING_TOKEN_EXPIRY',
    });
  }

  const maxAgeNumber = Number(maxAgeValue);
  if (Number.isNaN(maxAgeNumber)) {
    throw new APIException(c, STATUS_CODES.INTERNAL_SERVER_ERROR, {
      message: 'Invalid authentication token expiry format',
      code: 'INVALID_TOKEN_EXPIRY',
    });
  }

  const headers = new Headers(response.headers);
  headers.set('set-auth-token-expiry', maxAgeNumber.toString());

  return headers;
}
