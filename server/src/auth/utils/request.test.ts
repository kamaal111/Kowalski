import { describe, it, expect } from 'vitest';

import { parseTokenResponseAndCreateHeaders } from './request';
import env from '../../api/env';
import { ONE_DAY_IN_SECONDS } from '../../constants/common';

describe('parseTokenResponseAndCreateHeaders', () => {
  const mockJwt = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNzY1NzI4NTAzfQ.signature';
  const mockSessionToken = 'session-token-abc123';

  it('should create headers with JWT token', async () => {
    const mockResponse = new Response(JSON.stringify({ token: mockJwt }), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await parseTokenResponseAndCreateHeaders(mockResponse);

    expect(result.token).toBe(mockJwt);
    expect(result.headers.get('set-auth-token')).toBe(mockJwt);
    expect(result.headers.get('set-auth-token-expiry')).toBeTruthy();
  });

  it('should include session token headers when session token is provided', async () => {
    const mockResponse = new Response(JSON.stringify({ token: mockJwt }), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await parseTokenResponseAndCreateHeaders(mockResponse, mockSessionToken);

    expect(result.headers.get('set-auth-token')).toBe(mockJwt);
    expect(result.headers.get('set-auth-token-expiry')).toBeTruthy();
    expect(result.headers.get('set-session-token')).toBe(mockSessionToken);
    expect(result.headers.get('set-session-update-age')).toBeTruthy();
  });

  it('should not include session headers when session token is null', async () => {
    const mockResponse = new Response(JSON.stringify({ token: mockJwt }), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await parseTokenResponseAndCreateHeaders(mockResponse, null);

    expect(result.headers.get('set-auth-token')).toBe(mockJwt);
    expect(result.headers.get('set-session-token')).toBeNull();
    expect(result.headers.get('set-session-update-age')).toBeNull();
  });

  it('should calculate correct session update age from environment', async () => {
    const mockResponse = new Response(JSON.stringify({ token: mockJwt }), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await parseTokenResponseAndCreateHeaders(mockResponse, mockSessionToken);

    const sessionUpdateAge = result.headers.get('set-session-update-age');
    expect(sessionUpdateAge).toBeTruthy();

    const expectedAge = ONE_DAY_IN_SECONDS * env.BETTER_AUTH_SESSION_UPDATE_AGE_DAYS;
    expect(Number(sessionUpdateAge)).toBe(expectedAge);
  });

  it('should throw error when token is missing from response', async () => {
    const mockResponse = new Response(JSON.stringify({}), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await expect(parseTokenResponseAndCreateHeaders(mockResponse)).rejects.toThrow('Token not found in response');
  });

  it('should set content-type header to application/json', async () => {
    const mockResponse = new Response(JSON.stringify({ token: mockJwt }), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await parseTokenResponseAndCreateHeaders(mockResponse, mockSessionToken);

    expect(result.headers.get('content-type')).toBe('application/json');
  });
});
