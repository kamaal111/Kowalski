import { describe, it, expect } from 'vitest';

import { app, db } from '@test-vars';
import { createTestUserAndSession } from '@/tests/utils.js';
import type { SessionResponse } from '../schemas/responses.js';

describe('Sign-up and Session Flow', () => {
  it('should create user, get JWT, and retrieve session successfully', async () => {
    const email = `test_${Date.now()}@example.com`;
    const password = 'password123';
    const name = 'Test User';

    // Step 1: Sign up
    const signUpResponse = await app.request('/app-api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    expect(signUpResponse.status).toBe(201);

    // Extract JWT and session token from headers
    const authToken = signUpResponse.headers.get('set-auth-token');
    const sessionToken = signUpResponse.headers.get('set-session-token');
    const authTokenExpiry = signUpResponse.headers.get('set-auth-token-expiry');
    const sessionUpdateAge = signUpResponse.headers.get('set-session-update-age');

    expect(authToken).toBeTruthy();
    expect(sessionToken).toBeTruthy();
    expect(authTokenExpiry).toBeTruthy();
    expect(sessionUpdateAge).toBeTruthy();

    console.log('\nSign-up response headers:');
    console.log(`JWT: ${authToken?.substring(0, 20)}...`);
    console.log(`Session token: ${sessionToken}`);
    console.log(`JWT expiry: ${authTokenExpiry} seconds`);
    console.log(`Session update age: ${sessionUpdateAge} seconds`);

    // Step 2: Get session using JWT (should work immediately after sign-up)
    const sessionResponse = await app.request('/app-api/auth/session', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Cookie: `better-auth.session_token=${sessionToken}`,
      },
    });

    console.log(`\nSession request status: ${sessionResponse.status}`);

    if (sessionResponse.status !== 200) {
      const errorBody = await sessionResponse.text();
      console.log(`Session error response: ${errorBody}`);
    }

    expect(sessionResponse.status).toBe(200);

    const sessionData = (await sessionResponse.json()) as SessionResponse;
    expect(sessionData).toMatchObject({
      user: {
        name,
        email,
        email_verified: false,
      },
    });
    expect(sessionData.session).toBeDefined();
    expect(sessionData.session.expires_at).toBeDefined();
  });

  it('should work with existing test utility', async () => {
    const { token } = await createTestUserAndSession(db);

    const sessionResponse = await app.request('/app-api/auth/session', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(sessionResponse.status).toBe(200);
  });
});
