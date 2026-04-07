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

## Notes

- The existing portfolio UI test (`testAddTransactionFlowsShowExpectedFeedback`) uses `failCreateEntry` which triggers `.internalServerError`, NOT `.badRequest`. So it is unaffected by our validation error changes.
- The `ErrorResponseSchema` should remain unchanged for non-validation error responses (401, 404, 409, 500).
- Zod issues include `code`, `path`, and `message` as the core fields. Additional fields (like `minimum`, `type`) vary by error type. The schema uses `passthrough()` to allow extra fields without breaking.
- Auth 400 responses can come from either Zod validation (has `context.validations`) or BetterAuth business logic (no context). The schema handles both since `context` is optional.
