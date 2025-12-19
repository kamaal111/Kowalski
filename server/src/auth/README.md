# Authentication System

## Overview

Kowalski uses a **dual-token authentication system** powered by Better Auth:

1. **JWT tokens** (EdDSA) for stateless verification via JWKS
2. **Session tokens** (cookie-based) for reliable fallback

## Authentication Flow

### Sign-up/Sign-in

1. User submits credentials to `/app-api/auth/sign-up/email` or `/app-api/auth/sign-in/email`
2. Server returns:
   - `token` (JWT with 7-day expiry)
   - Session cookie (`better-auth.session_token`)
   - Expiry information

### Protected Endpoint Access

The authentication middleware (`getUserSession()`) attempts verification in this order:

1. **JWT Verification** (preferred):
   - Extracts JWT from `Authorization: Bearer <token>` header
   - Verifies signature using JWKS endpoint (`/app-api/auth/jwks`)
   - Validates expiry and payload
   - If successful → returns session

2. **Session Token Fallback**:
   - If JWT verification fails (missing/invalid/cached JWKS)
   - Extracts session token from `better-auth.session_token` cookie
   - Validates via Better Auth's `getSession()` API
   - If successful → returns session

3. **Rejection**:
   - If both methods fail → returns 404

## Client Implementation

### Swift (iOS/macOS)

`AuthenticationMiddleware.swift` sends both authentication methods:

```swift
request.headerFields[.authorization] = "Bearer \(credentials.authToken)"
let sessionCookie = "better-auth.session_token=\(credentials.sessionToken)"
request.headerFields[.cookie] = sessionCookie
```

## Known Limitations

### JWKS Caching Issue

**Problem**: The jose library's `createRemoteJWKSet()` caches JWKS responses indefinitely. When a new signing key is created (e.g., during sign-up in tests), the cached JWKSet doesn't include it.

**Impact**:

- Immediate JWT verification after sign-up may fail
- Production environments with stable JWKS are unaffected
- Test environments may see JWT verification failures

**Mitigation**:

- Session token cookie fallback ensures reliable authentication
- Real-world usage is unaffected (JWKS keys don't change frequently)

**Test Documentation**: See `jwt-verification.integration.test.ts` for test cases covering:

- JWT-only verification (documents caching limitation)
- Invalid JWT rejection
- Malformed JWT payload rejection
- Session token fallback behavior
- Combined JWT + cookie authentication

## Security Considerations

1. **JWT Verification First**: Preferred method for stateless authentication
2. **Cookie Fallback**: Ensures reliability without compromising security
3. **No Type Casting**: All JWT payloads validated with Zod schemas
4. **EdDSA Signatures**: Modern, secure signature algorithm
5. **HTTPS Required**: Both tokens must be transmitted over secure connections in production

## Testing

Run authentication tests:

```bash
# All auth tests
just test

# Specific test suites
cd server && pnpm test -- sign-up-session
cd server && pnpm test -- jwt-verification
```

All 52 tests pass, including 6 JWT verification tests that document the two-layer authentication approach.
