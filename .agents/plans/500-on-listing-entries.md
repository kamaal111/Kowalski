# Surface Validation Errors in OpenAPI Spec

## Problem

When Zod validation fails on a request body, the server returns:

```json
{
  "message": "Invalid payload",
  "code": "INVALID_PAYLOAD",
  "context": {
    "validations": [{ "path": ["amount"], "message": "Number must be greater than 0", "code": "too_small" }]
  }
}
```

However, the `ErrorResponseSchema` in the OpenAPI spec only documents `{ message, code }`. The `context.validations` field is invisible to the generated Swift client, so the app can only show generic messages like "Invalid credentials provided" or "Invalid information provided" instead of telling the user **which field** was wrong.

## Approach

1. Create a dedicated `ValidationErrorResponseSchema` that documents the full validation error structure including `context.validations`
2. Use it on 400 responses for all routes that accept request bodies (sign-up, sign-in, create-entry)
3. Update the Swift client to parse validation details from bad request responses
4. Update the feature layer to build field-specific error messages
5. Add server integration tests for validation error responses on auth routes
6. Verify existing UI tests remain passing

## Todos

### Server: Schema & Routes

- **`validation-error-schema`** — Create `ValidationErrorResponseSchema` in `server/src/schemas/errors.ts` alongside the existing `ErrorResponseSchema`. Schema shape: `{ message: string, code?: string, context?: { validations: [{ code: string, path: (string|number)[], message: string }] } }`. Register with `.openapi('ValidationErrorResponse', ...)`.

- **`update-sign-up-route`** — In `server/src/auth/routes/sign-up.ts`, replace `ErrorResponseSchema` with `ValidationErrorResponseSchema` for the 400 response. Depends on: `validation-error-schema`.

- **`update-sign-in-route`** — In `server/src/auth/routes/sign-in.ts`, replace `ErrorResponseSchema` with `ValidationErrorResponseSchema` for the 400 response. Depends on: `validation-error-schema`.

- **`update-create-entry-route`** — In `server/src/portfolio/routes/create-entry.ts`, replace `ErrorResponseSchema` with `ValidationErrorResponseSchema` for the 400 response. Depends on: `validation-error-schema`.

### Server: Integration Tests

- **`sign-up-validation-tests`** — Add integration tests in `server/src/auth/tests/sign-up-validation.integration.test.ts` that send invalid payloads (bad email, short password, single-word name) and verify the 400 response matches the `ValidationErrorResponseSchema` structure with correct field paths. Depends on: `update-sign-up-route`.

- **`sign-in-validation-tests`** — Add integration tests in `server/src/auth/tests/sign-in-validation.integration.test.ts` for invalid sign-in payloads and verify validation error structure. Depends on: `update-sign-in-route`.

- **`update-create-entry-tests`** — Update `server/src/portfolio/tests/create-entry.integration.test.ts` to import the shared `ValidationErrorResponseSchema` instead of defining a local one. Depends on: `validation-error-schema`.

### OpenAPI Spec & Swift Client

- **`download-spec`** — Run `just download-spec` to regenerate the OpenAPI spec with the new `ValidationErrorResponse` schema. Depends on: `update-sign-up-route`, `update-sign-in-route`, `update-create-entry-route`.

- **`update-auth-client-errors`** — Update `KowalskiAuthSignUpErrors` and `KowalskiAuthSignInErrors` to include validation details in the `badRequest` case (e.g., `badRequest(validations: [ValidationIssue])`). Update the client implementation to extract `context.validations` from the response. Depends on: `download-spec`.

- **`update-portfolio-client-errors`** — Update `KowalskiPortfolioClientCreateEntryErrors.badRequest` to include validation details alongside `errorCode`. Update the client implementation. Depends on: `download-spec`.

### Swift Feature Layer

- **`update-auth-feature-errors`** — Update `KowalskiAuth` error types (`KowalskiAuthSignUpErrors`, `KowalskiAuthSignInErrors`) to produce field-specific error messages from validation details when available. Format: first validation issue as `"{field}: {message}"`. Falls back to current generic message when no validation context. Depends on: `update-auth-client-errors`.

- **`update-portfolio-feature-errors`** — Update `StoreTransactionErrors.badRequest` to include validation details and produce field-specific messages. Depends on: `update-portfolio-client-errors`.

### Verification

- **`verify-all`** — Run `just ready` to verify the full pipeline: server tests, Swift client build, UI tests. Depends on all above.

### Fix: 500 on GET /entries & Better Error Logging

- **`apply-migration`** — Run `just migrate` to apply pending migration 0001 (`0001_tough_lenny_balinger.sql`) which adds `sector`, `industry`, and `exchange_dispatch` columns to `stock_ticker`. The list-entries query selects these columns via Drizzle, but they don't exist in the actual database yet because the migration (generated today) hasn't been applied. This is the root cause of the 500 error. No dependencies.

- **`improve-error-logging`** — Improve `makeUncaughtErrorLog` in `server/src/middleware/logging.ts` to log the full error cause chain and stack trace. Currently it only does `String(err)`, which for Drizzle DB errors shows "Failed query: SELECT ..." but loses the underlying PostgreSQL error (e.g., `column "sector" does not exist`). The fix should: (1) log `err.stack` for stack traces, (2) recursively walk `err.cause` to surface wrapped database errors. No dependencies.

- **`test-error-logging`** — Add an integration test that verifies uncaught exceptions are logged with their cause chain. The test should simulate a database error scenario and verify the log output includes the underlying error message, not just the wrapper. Depends on: `improve-error-logging`.

## Notes

- The existing portfolio UI test (`testAddTransactionFlowsShowExpectedFeedback`) uses `failCreateEntry` which triggers `.internalServerError`, NOT `.badRequest`. So it is unaffected by our validation error changes.
- The `ErrorResponseSchema` should remain unchanged for non-validation error responses (401, 404, 409, 500).
- Zod issues include `code`, `path`, and `message` as the core fields. Additional fields (like `minimum`, `type`) vary by error type. The schema uses `passthrough()` to allow extra fields without breaking.
- Auth 400 responses can come from either Zod validation (has `context.validations`) or BetterAuth business logic (no context). The schema handles both since `context` is optional.
- **Root cause of 500**: Migration 0001 adds `sector`, `industry`, `exchange_dispatch` to `stock_ticker`. The Drizzle schema already references these columns in the list-entries query, but the actual database doesn't have them yet. Tests pass because `createTestDatabase()` runs all migrations on a fresh DB.
- **Logging gap**: `makeUncaughtErrorLog` uses `String(err)` which for Drizzle errors shows the query text but NOT the underlying PostgreSQL error. The cause (e.g., `column "sector" does not exist`) lives in `err.cause` which is never logged.
