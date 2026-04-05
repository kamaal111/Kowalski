## Native Settings + Server-Backed Preferred Currency

### Summary

Add a native macOS `Settings` scene for preferred currency, store the value on the server as part of the `user` record, and use that preference as the default currency for new transaction creation without removing any other currency choices.

### Key Changes

- Add a nullable `preferred_currency` column to the server `user` table.
  Existing users start as `null`; the app will seed the value after login using the device locale and fall back to `USD` when the locale currency is unsupported by `ForexKit`.
- Extend `GET /auth/session` so `user.preferred_currency` is included in the response.
  This must be populated for both cookie-based session lookup and bearer-token lookup.
- Add an authenticated `PATCH /auth/preferences` endpoint with request body:
  `{ preferred_currency: string }`
  and response body:
  `{ preferred_currency: string }`
- Keep server validation at the API boundary for a 3-letter currency code; the app remains the source of selectable options by using `ForexKit`.
- Extend the Swift auth client/session models to carry `preferredCurrency`.
  `UserSession` should gain an optional preferred-currency field, and `KowalskiAuth` should expose a derived effective currency:
  server value if present, otherwise locale-derived currency if supported, otherwise `USD`.
- On first authenticated load, if `preferred_currency` is `null`, the app should immediately persist the derived effective currency through `PATCH /auth/preferences`, then update the in-memory and cached session.
- Add a public settings view in the auth/features package and host it from a native macOS `Settings` scene in the app target.
  The pane should contain a currency picker backed by `ForexKit` and an explicit save action with success/error feedback.
- Use the auth preference when opening transaction-creation flows:
  toolbar “Add entry” and paired buy/sell creation should initialize the form with the effective preferred currency.
  Edit flows must continue using the entry’s existing currency.
- Do not change the available currency list in the transaction form.
  The preferred currency only controls the initially selected value.

### Public API / Interface Changes

- Server `GET /app-api/auth/session` response:
  add `user.preferred_currency: string | null`
- Server `PATCH /app-api/auth/preferences`:
  request `{ preferred_currency: string }`
  response `{ preferred_currency: string }`
- Swift client/auth models:
  add `preferredCurrency` to `KowalskiAuthSessionResponse` and `UserSession`
- Transaction-form defaults:
  replace the hardcoded `.USD` empty-state default with a preferred-currency-aware initializer/factory

### Test Plan

- Server integration tests:
  `GET /auth/session` returns `preferred_currency` when set
  `GET /auth/session` returns `preferred_currency: null` when unset
  JWT-authenticated session lookup still returns the stored preference
  `PATCH /auth/preferences` updates the user row and returns the saved value
  `PATCH /auth/preferences` rejects invalid currency payloads
- Swift tests:
  auth mapper preserves `preferredCurrency`
  auth effective-currency fallback uses locale currency when supported, otherwise `USD`
  first-load seeding updates cached/in-memory session when server preference is missing
  transaction form defaults use the auth preference for normal create and paired create
  edit flow keeps the entry currency unchanged
- Verification for implementation turn:
  run the relevant focused tests during development, then finish with `just ready`

### Assumptions

- “Settings pane” means a native macOS `Settings` window, not an in-app route.
- Locale-based defaulting should happen in the app, not on the server, because only the app has reliable access to the user’s device locale.
- `ForexKit` defines the currencies users can choose from in the UI.
- If the settings update fails during first-load seeding, the app should still use the derived effective currency for that launch and retry on the next authenticated session load.
