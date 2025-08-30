# Authentication Spec (Signup & Login)

## Milestones & Checklist

- [x] Foundation: agree on scope/non-goals and env vars
  - [x] Confirm `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`
  - [x] Decide on `SIGNUP_AUTO_LOGIN` default
- [x] Database: schema updates and migrations
  - [x] Rename `password` → `password_hash` and add lockout fields
  - [x] Create `refresh_tokens` table with indices
  - [x] Enforce case-insensitive unique on email (CITEXT or `lower(email)` index)
- [x] Services: auth and users
  - [x] Password hashing/verification (argon2id via `@node-rs/argon2`)
  - [x] JWT issue/verify helpers (HS256 via `jose`)
  - [x] Refresh token generator, hash, rotation, revoke
- [x] Routes: minimal happy-path
  - [x] POST `/auth/signup`
  - [x] POST `/auth/login`
- [ ] Routes: session lifecycle
  - [ ] POST `/auth/refresh`
  - [ ] POST `/auth/logout`
  - [ ] GET `/auth/me`
- [ ] Security & middleware
  - [ ] Cookie helpers and secure flags
  - [ ] Bearer auth middleware for protected routes
  - [ ] Basic rate limiting and lockout enforcement
- [ ] OpenAPI & validation
  - [ ] Zod schemas for requests/responses
  - [ ] Document endpoints in `/doc` via `@hono/zod-openapi`
  - [x] Minimal JWT payload validation via Zod during verify
- [x] Testing
  - [x] Route tests (Vitest): signup/login happy paths and failures (mocked services)
  - [ ] Add broader unit tests: hashing, JWT, rotation, lockout
  - [ ] Add integration tests: signup → login → me, refresh, logout

## Scope & Goals

- Provide secure email/password signup, login, token refresh, logout, and current-user endpoints for the Hono API.
- Strong validation, clear error semantics, OpenAPI documentation, and production-friendly security defaults.
- Non-goals: social login, passwordless, email delivery (can be added later).

## Architecture Overview

- Access token: JWT (HS256) for stateless auth in `Authorization: Bearer`.
- Refresh token: opaque random value stored as HttpOnly cookie; hashed and persisted for rotation/revocation.
- Libraries: `zod`, `@hono/zod-openapi`, `drizzle-orm`, `jose` (JWT), `@node-rs/argon2` (or `argon2`) for hashing, `hono/cookie` for cookies.

## Data Model Changes

- users (existing; proposed changes):
  - Rename `password` → `password_hash` (varchar 255).
  - Add `failed_login_attempts` int DEFAULT 0, `locked_until` timestamptz NULL.
  - Keep `email_verified` (bool) and `timezone`.
  - Unique index on `lower(email)` to enforce case-insensitive uniqueness (or migrate to CITEXT).
  - Email CHECK constraint already exists; keep it.
- refresh_tokens (new):
  - `id` uuid PK, `user_id` uuid FK → users(id) ON DELETE CASCADE
  - `token_hash` varchar(255) UNIQUE (SHA-256 of raw token)
  - `issued_at` timestamptz DEFAULT now(), `expires_at` timestamptz NOT NULL
  - `revoked_at` timestamptz NULL, `replaced_by_token` varchar(255) NULL

## Database Changes & Migrations

Drizzle schema changes (TypeScript):

```ts
// users: rename and add fields
export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 255 }).notNull().unique(),
    email_verified: boolean().notNull().default(false),
    password_hash: varchar({ length: 255 }).notNull(),
    failed_login_attempts: integer().notNull().default(0),
    locked_until: timestamp({ withTimezone: true }),
    timezone: varchar({ length: 50 }).notNull().default('UTC'),
    last_login_at: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deleted_at: timestamp({ withTimezone: true }),
  },
  table => [
    // Case-insensitive unique email
    uniqueIndex('users_email_ci_idx').on(sql`lower(${table.email})`),
    // Email format already enforced via CHECK
  ],
);

// refresh_tokens
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid()
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token_hash: varchar({ length: 255 }).notNull().unique(),
    issued_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp({ withTimezone: true }).notNull(),
    revoked_at: timestamp({ withTimezone: true }),
    replaced_by_token: varchar({ length: 255 }),
  },
  table => [index('refresh_tokens_user_id_idx').on(table.user_id)],
);
```

Safe migration plan:

- Phase 1: Add `password_hash` (nullable), backfill from `password` (`UPDATE users SET password_hash = password WHERE password_hash IS NULL`), then set NOT NULL; keep `password` temporarily.
- Phase 2: Drop `password` column when code no longer uses it.
- Add `failed_login_attempts` (default 0) and `locked_until`.
- Create `refresh_tokens` table and `refresh_tokens_user_id_idx`.
- Add `users_email_ci_idx` unique index on `lower(email)`; keep existing case-sensitive unique to avoid naming dependency.

Commands:

- Ensure `.env` has `DATABASE_URL` and Postgres is running: `just start-services`.
- Apply changes: `just make-migrations` (runs Drizzle push using current schema).

## Environment Variables

Decisions & defaults (foundation agreed):

- `JWT_SECRET` (required): HS256 signing secret; random ≥ 32 bytes. Example: 64-char hex.
- `ACCESS_TOKEN_TTL` (required; default 900): access token lifetime in seconds (15m).
- `REFRESH_TOKEN_TTL` (required; default 2592000): refresh token lifetime in seconds (~30d).
- `SIGNUP_AUTO_LOGIN` (optional; default true): when true, signup issues tokens immediately.
- Password hashing overrides (optional):
  - `ARGON2_TIME_COST` (default 3), `ARGON2_MEMORY_COST` (default 65536 KB), `ARGON2_PARALLELISM` (default 1).
    Notes:
- Cookies use `Secure` in production; `SameSite=Lax`, `HttpOnly` always. No extra env needed.

## HTTP Endpoints

- POST `/auth/signup`
  - Body: `{ email, password, timezone? }`
  - Validates email + strong password. Lowercase email for uniqueness.
  - Creates user with `password_hash` (argon2id). Optionally auto-login.
  - 201 `{ user: { id, email, emailVerified } }`. 409 if email exists.
- POST `/auth/login`
  - Body: `{ email, password }`
  - Validates; checks `locked_until`; verifies password.
  - Resets/increments `failed_login_attempts` accordingly.
  - Issues access token + sets `refresh_token` cookie; persists hashed refresh token.
  - 200 `{ accessToken, expiresIn }`. 401 invalid credentials. 423 locked.
- POST `/auth/refresh`
  - Cookie: `refresh_token` (HttpOnly, Secure, SameSite=Lax, Path=/auth)
  - Verifies + rotates token (revoke old, issue new). Returns new access token and sets new refresh cookie.
  - 401/403 on invalid/expired/revoked.
- POST `/auth/logout`
  - Revokes current refresh token (if present) and clears cookie.
  - 204 No Content.
- GET `/auth/me`
  - Requires Bearer access token.
  - 200 `{ id, email, emailVerified, timezone, createdAt }`.

## Validation & Security

- Passwords: argon2id (timeCost=3, memory=64MB, parallelism=1). Constant-time comparisons.
- Tokens: access JWT with `sub`, `iat`, `exp`. Refresh is random 256-bit value (e.g., `crypto.randomUUID() + extraRandomBytes`) hashed with SHA-256 in DB.
- Cookies: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/auth`, `Max-Age=REFRESH_TOKEN_TTL`.
- Lockout: after 5 failed attempts, set `locked_until = now() + 15 minutes`.
- Rate limiting: basic per-IP/email for `/auth/*` (plug-in later; simple in-memory dev guard acceptable).

## Implementation Plan (Files & Steps)

- Routes: `server/src/routes/auth.ts`
  - Define zod schemas with `@hono/zod-openapi` for bodies/responses.
  - Implement the five endpoints, wiring to services.
- Services:
  - `server/src/services/auth.ts`: password hashing/verification, JWT issue/verify, refresh rotation, cookie helpers.
  - `server/src/services/users.ts`: user CRUD and lookup by email.
- DB:
  - Update `server/src/db/schema.ts` (rename `password` → `password_hash`; add columns).
  - Add `refresh_tokens` table.
  - Migrations via `just make-migrations` (uses `DATABASE_URL`).
- Middleware:
  - JWT verify helper for protected routes (e.g., `bearerAuthMiddleware`).
  - Cookie utilities from `hono/cookie`.
- OpenAPI:
  - Mount under `/auth/*` and ensure `/doc` shows auth endpoints.

## Error Model

- 400 Invalid payload (use existing `InvalidPayload`).
- 401 Bad credentials / missing or invalid token.
- 403 Refresh misuse/rotation violation.
- 409 Email already registered.
- 423 Account locked.

## Testing Plan

- Unit: hash/verify, JWT issue/verify, refresh rotation, lockout.
- Integration: signup → login → me; failed logins lockout; refresh; logout revocation.
- Infra: use Docker Postgres (`just start-services`), migrations via `just make-migrations`.

## Open Questions

- Auto-login after signup? (`SIGNUP_AUTO_LOGIN` default true?)
- Enforce case-insensitive unique via CITEXT vs unique index on `lower(email)`?
- Email verification in v1 or later? If in v1, add token columns and endpoint now.
