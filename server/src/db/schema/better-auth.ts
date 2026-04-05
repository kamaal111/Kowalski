import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Better Auth's canonical user record.
 *
 * App-owned tables such as `portfolio` reference this row for ownership.
 */
export const user = pgTable('user', {
  // Primary user identifier propagated into auth responses and portfolio ownership.
  id: text('id').primaryKey(),
  // User-facing display name returned from the auth session endpoint.
  name: text('name').notNull(),
  // Unique sign-in email used by email/password auth.
  email: text('email').notNull().unique(),
  // Whether the auth provider considers the email verified.
  emailVerified: boolean('email_verified').default(false).notNull(),
  // Optional avatar URL supplied by the auth provider.
  image: text('image'),
  // When the user account was created.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Last time Better Auth updated the user row.
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // ISO 4217 currency code the user prefers for new transactions (e.g. "USD").
  // Null until the app seeds the value from the device locale on first login.
  preferredCurrency: text('preferred_currency'),
});

/**
 * Better Auth session storage for cookie-based login state and session lookups.
 */
export const session = pgTable('session', {
  // Primary identifier for the persisted session row.
  id: text('id').primaryKey(),
  // When the session becomes invalid.
  expiresAt: timestamp('expires_at').notNull(),
  // Session token used by Better Auth and echoed via auth response headers.
  token: text('token').notNull().unique(),
  // When the session row was created.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Last time Better Auth refreshed the session row.
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // Optional source IP recorded by Better Auth.
  ipAddress: text('ip_address'),
  // Optional user-agent string recorded by Better Auth.
  userAgent: text('user_agent'),
  // Owning user for the session.
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

/**
 * Better Auth account/provider linkage.
 *
 * This stores credentials or provider identifiers for the enabled sign-in
 * methods. The app does not read it directly.
 */
export const account = pgTable('account', {
  // Primary identifier for the linked auth account row.
  id: text('id').primaryKey(),
  // Provider-side account identifier.
  accountId: text('account_id').notNull(),
  // Auth provider name, for example email/password or an OAuth provider.
  providerId: text('provider_id').notNull(),
  // App user that owns this linked account.
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Optional provider access token managed by Better Auth.
  accessToken: text('access_token'),
  // Optional provider refresh token managed by Better Auth.
  refreshToken: text('refresh_token'),
  // Optional provider id token for OpenID-based flows.
  idToken: text('id_token'),
  // When the provider access token expires, if applicable.
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  // When the provider refresh token expires, if applicable.
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  // Provider-granted scopes associated with the account.
  scope: text('scope'),
  // Password hash for email/password auth when managed by Better Auth.
  password: text('password'),
  // When the linked account row was created.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Last time Better Auth updated the linked account row.
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * Better Auth verification records for short-lived auth flows such as email
 * verification or reset-style challenges.
 */
export const verification = pgTable('verification', {
  // Primary identifier for the verification row.
  id: text('id').primaryKey(),
  // Target identifier being verified, such as an email address.
  identifier: text('identifier').notNull(),
  // Verification value or code managed by Better Auth.
  value: text('value').notNull(),
  // When the verification record is no longer valid.
  expiresAt: timestamp('expires_at').notNull(),
  // When the verification row was created.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Last time Better Auth updated the verification row.
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * Better Auth JWT signing keys.
 *
 * The `/jwks` endpoint publishes the public keys, and test-time JWT
 * verification reads them directly from this table.
 */
export const jwks = pgTable('jwks', {
  // Key id used as the JWT `kid`.
  id: text('id').primaryKey(),
  // Public JWK served by the auth JWKS endpoint and used for JWT verification.
  publicKey: text('public_key').notNull(),
  // Private JWK retained for token signing by Better Auth.
  privateKey: text('private_key').notNull(),
  // When the keypair was generated.
  createdAt: timestamp('created_at').notNull(),
});
