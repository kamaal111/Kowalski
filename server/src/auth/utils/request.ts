import path from 'node:path';

import z from 'zod';
import { decodeJwt, type JWTPayload } from 'jose';

import type { HonoContext } from '../../api/contexts.js';
import { getValueFromSetCookie, makeNewRequest } from '../../utils/request.js';
import { BetterAuthException } from '../exceptions.js';
import { APIException, Unauthorized } from '../../api/exceptions.js';
import { STATUS_CODES } from '../../constants/http.js';
import { errorLogger } from '../../middleware/logging.js';
import env from '../../api/env.js';
import { APP_API_BASE_PATH, ONE_DAY_IN_SECONDS } from '../../constants/common.js';
import tokenRoute from '../routes/token.js';
import { ROUTE_NAME } from '../constants.js';

const { BETTER_AUTH_URL, BETTER_AUTH_SESSION_UPDATE_AGE_DAYS, JWT_EXPIRY_DAYS } = env;
const TOKEN_URL = new URL(path.join(BETTER_AUTH_URL, APP_API_BASE_PATH, ROUTE_NAME, tokenRoute.path));

const BetterAuthExceptionSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const TokenResponseSchema = z.object({
  token: z.string().optional(),
});

export async function handleAuthRequest<Schema extends z.ZodType>(
  c: HonoContext,
  options: { responseSchema: Schema },
): Promise<{ jsonResponse: z.infer<Schema>; sessionToken: string }> {
  const request = await makeNewRequest(c);
  const response = await c.get('auth').handler(request);
  const jsonResponse: unknown = await response.json();
  const exceptionResult = BetterAuthExceptionSchema.safeParse(jsonResponse);
  if (exceptionResult.success) {
    errorLogger(c, `better-auth error -> ${JSON.stringify(exceptionResult.data)}`);

    throw new BetterAuthException(c, {
      code: exceptionResult.data.code,
      message: exceptionResult.data.message,
      headers: response.headers,
    });
  }

  const validatedResponse = options.responseSchema.parse(jsonResponse);
  const sessionToken = getValueFromSetCookie(response.headers, 'better-auth.session_token');
  if (!sessionToken) {
    throw new APIException(c, STATUS_CODES.INTERNAL_SERVER_ERROR, {
      message: 'Failed to retrieve session token from authentication response',
      code: 'MISSING_SESSION_TOKEN',
    });
  }

  return { jsonResponse: validatedResponse, sessionToken };
}

/**
 * Gets JWT after authentication by calling the /token endpoint with the session token
 */
export async function getHeadersWithJwtAfterAuth(c: HonoContext, sessionToken: string): Promise<Headers> {
  const tokenRequestHeaders = new Headers({ Authorization: `Bearer ${sessionToken}` });
  const tokenRequest = new Request(TOKEN_URL, { method: 'GET', headers: tokenRequestHeaders });
  const response = await c.get('auth').handler(tokenRequest);
  if (!response.ok) {
    errorLogger(c, `Failed to retrieve JWT from token endpoint. Status: ${response.status}, URL: ${TOKEN_URL}`);
    throw new Unauthorized(c);
  }

  const responseJson: unknown = await response.json();
  const responseData = TokenResponseSchema.parse(responseJson);
  const headers = createHeadersWithJwt(responseData.token);

  headers.set('set-session-token', sessionToken);
  const sessionUpdateAgeSeconds = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_UPDATE_AGE_DAYS;
  headers.set('set-session-update-age', sessionUpdateAgeSeconds.toString());

  return headers;
}

function createHeadersWithJwt(jwt: string | undefined): Headers {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  if (!jwt) return headers;

  let payload: JWTPayload | undefined;
  try {
    payload = decodeJwt(jwt);
  } catch {
    // Swallow
  }

  const expirySeconds = payload?.exp
    ? payload.exp - Math.floor(Date.now() / 1000)
    : ONE_DAY_IN_SECONDS * JWT_EXPIRY_DAYS;
  headers.set('set-auth-token', jwt);
  headers.set('set-auth-token-expiry', expirySeconds.toString());

  return headers;
}

/**
 * Parses token response from better-auth and creates headers with JWT info
 */
export async function parseTokenResponseAndCreateHeaders(
  response: Response,
  sessionToken: string | null = null,
): Promise<{ token: string; headers: Headers }> {
  const jsonResponse: unknown = await response.json();
  const responseData = TokenResponseSchema.parse(jsonResponse);
  if (!responseData.token) {
    throw new Error('Token not found in response');
  }

  const headers = createHeadersWithJwt(responseData.token);
  if (sessionToken) {
    headers.set('set-session-token', sessionToken);
    const sessionUpdateAgeSeconds = ONE_DAY_IN_SECONDS * BETTER_AUTH_SESSION_UPDATE_AGE_DAYS;
    headers.set('set-session-update-age', sessionUpdateAgeSeconds.toString());
  }

  return { token: responseData.token, headers };
}
