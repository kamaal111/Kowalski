## Problem

Add a `list portfolio entries` endpoint for the signed-in user's implicit/default portfolio. The current portfolio surface only exposes `POST /app-api/portfolio/entry`, and that handler is still a canned response rather than DB-backed logic. The implementation plan therefore needs to cover three related changes together: renaming the portfolio-entry collection endpoint to `/app-api/portfolio/entries`, adding the new read endpoint contract on that plural path, and introducing the missing portfolio test-data setup needed to test against real persisted rows.

## Current State

### Server

- `server/src/portfolio/routes/index.ts` only registers `create-entry`.
- `server/src/portfolio/routes/create-entry.ts` already establishes the portfolio routing style, auth middleware, and OpenAPI response documentation, but it currently uses the singular `/app-api/portfolio/entry` path that should become plural.
- `server/src/portfolio/handlers/create-entry.ts` is a stub that returns hard-coded data and does not read/write the database.
- `server/src/db/schema/portfolio.ts` defines `portfolio` and `portfolio_transaction`, with transactions belonging to a portfolio and a stock ticker.
- Integration tests use isolated PostgreSQL databases plus authenticated sessions via `server/src/tests/fixtures.ts` and `server/src/tests/utils.ts`.

### App

- The generated `openapi.yaml` client spec already shows `POST /app-api/portfolio/entries` on the plural path (operation `postAppApiPortfolioEntries`), suggesting the rename may have already propagated to the client artifact. The server-side route file still needs to be verified.
- `KowalskiPortfolioClient` (protocol + implementation in `app/KowalskiClient/`) only exposes `createEntry`. There is no `listEntries` method, no list response model, and no list error type.
- `KowalskiPortfolioClientCreateEntryResponse` is the only entry response model. It has the same shape the list endpoint will return (id, createdAt, updatedAt, stock, amount, purchasePrice, transactionType, transactionDate), so it should be renamed to a neutral shared model and reused rather than duplicated.
- `KowalskiPortfolio` (`app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`) is an `@Observable` class. It currently only has `storeTransaction()`. It needs an `entries` property and a `fetchEntries()` method.
- `KowalskiPortfolioScreen` is a placeholder that only shows the "Kowalski" title and a `+` toolbar button. No list view, no loading state, and no empty state are implemented.
- Navigation is SwiftUI-native (`NavigationStack` + `NavigationLink`). The `+` button already links to `KowalskiPortfolioTransactionScreen`. No detail screen for individual entries exists yet.
- `KowalskiEnvironment` (in `KowalskiUtils`) provides ProcessInfo flags for UI testing. An existing flag `IS_UI_TESTING_FAIL_CREATE_ENTRY` demonstrates the pattern for mocking failures in preview/test mode.

## Agreed Scope

- Portfolio ownership model: a single implicit/default portfolio per signed-in user.
- Endpoint shape: a simple authenticated `GET` returning all entries for that default portfolio in v1, sharing the plural collection path with `POST`.
- No pagination, filtering, or explicit `portfolioId` in v1.

## Proposed Approach

### Server

1. Verify the server-side create-entry route and rename it from `POST /app-api/portfolio/entry` to `POST /app-api/portfolio/entries` if not already done.
2. Introduce a shared portfolio-entry response schema so the list route and the create route can describe the same entry payload consistently.
3. Add portfolio test-data helpers that create a default portfolio plus associated transactions directly in the test database. This avoids depending on the stubbed create-entry handler for list-endpoint setup.
4. Implement a DB-backed list handler that:
   - resolves the signed-in user from request context,
   - loads that user's default portfolio,
   - queries its transactions and required ticker data,
   - maps DB rows into the public API shape,
   - returns a stable, documented order (newest transaction first, then newest update as a tiebreaker).
5. Regenerate the OpenAPI spec via `just download-spec` so the `openapi.yaml` in `KowalskiClient` is updated with the new `GET /app-api/portfolio/entries` operation.

### App

6. Rename `KowalskiPortfolioClientCreateEntryResponse` to a neutral shared model (e.g. `KowalskiPortfolioClientEntryResponse`) and update all existing call sites. The list endpoint returns the same entry shape, so no separate model is needed.
7. Add `listEntries()` to the `KowalskiPortfolioClient` protocol and its implementation, mapping from the generated OpenAPI `getAppApiPortfolioEntries` operation. Follow the same `Result`-returning async pattern used by `createEntry`.
8. Add a `KowalskiPortfolioClientListEntriesErrors` error enum (`.unknown`, `.unauthorized`) aligned with the server contract.
9. Extend `KowalskiPortfolio` with `var entries: [PortfolioEntry]` (or the appropriate domain model) and a `fetchEntries() async` method. Call `fetchEntries()` on `.task` in the portfolio screen.
10. Replace the placeholder `KowalskiPortfolioScreen` with a proper list view using SwiftUI `List`. After a successful `storeTransaction()`, refresh entries so the new item appears without requiring a manual pull-to-refresh.
    - Empty state: show a descriptive message when `entries` is empty.
    - Loading state: show a `ProgressView` while the first fetch is in-flight.
    - Each row should surface the stock symbol/name, transaction type, amount, and transaction date at minimum.
11. Add a preview/mock implementation of `listEntries()` in the existing `KowalskiPortfolioClient` preview provider, following the `IS_UI_TESTING_FAIL_CREATE_ENTRY` pattern for failure scenarios.

## Todos

### Server

1. **Verify and fix the plural path rename**
   - Confirm whether the server-side create-entry route is already on `/app-api/portfolio/entries` or still on the singular path.
   - If still singular, rename it. Ensure no test or doc references the old singular path.

2. **Define shared portfolio entry schemas**
   - Extract/reuse a common API schema for a persisted portfolio entry response.
   - Add a list response schema (`z.array(...)`) for the new `GET /app-api/portfolio/entries` route.
   - Keep OpenAPI names and examples consistent with the existing create-entry documentation.

3. **Add default-portfolio test helpers**
   - Create reusable helpers for inserting a portfolio for a specific test user and seeding one or more `portfolio_transaction` rows plus referenced ticker rows.
   - Prefer direct DB seeding so list-route setup is deterministic and independent of the unfinished write-path logic.

4. **Implement the list route and handler**
   - Add a new route module under `server/src/portfolio/routes/`.
   - Register it in `server/src/portfolio/routes/index.ts`.
   - Implement the handler under `server/src/portfolio/handlers/` using Drizzle queries and explicit row-to-response mapping.
   - Return an empty array when the user has no default portfolio or no entries yet.

5. **Add integration tests against a real database**
   - Tests must use a real (isolated) PostgreSQL database via the existing `integrationTest` fixture. No mocking of DB layers.
   - Seed data directly using the test helpers from todo 3; do not call the `POST` endpoint to set up state for the `GET` tests.
   - Cover at minimum:
     - authenticated `GET /app-api/portfolio/entries` returns seeded entries,
     - entries are returned in the documented order (newest transaction first, then newest update),
     - unauthenticated request is rejected with `401`,
     - empty state returns `200` with `[]`,
     - user isolation: user A cannot see user B's entries,
     - the `POST /app-api/portfolio/entries` contract still behaves as expected.
   - Validate response bodies with Zod schemas rather than loose object assertions where practical.

6. **Regenerate the OpenAPI spec**
   - Run `just download-spec` once the server is updated.
   - Ensure the spec reflects the pluralized path for both `GET` and `POST`.
   - Confirm the generated client in `KowalskiClient/Sources/KowalskiClient/openapi.yaml` now includes a `getAppApiPortfolioEntries` operation.

### App

7. **Rename the shared entry response model**
   - Rename `KowalskiPortfolioClientCreateEntryResponse` to `KowalskiPortfolioClientEntryResponse` (or equivalent neutral name).
   - Update all existing usages: `KowalskiPortfolioClient`, mappers, `KowalskiPortfolio`, any call sites in `KowalskiPortfolioTransactionScreen`.

8. **Add `listEntries` to `KowalskiPortfolioClient`**
   - Add method to protocol: `listEntries() async -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors>`.
   - Implement in the concrete type using the generated `getAppApiPortfolioEntries` operation.
   - Add `KowalskiPortfolioClientListEntriesErrors` enum with at minimum `.unknown` and `.unauthorized`.
   - Add a mapper from the generated list response type to `[KowalskiPortfolioClientEntryResponse]` in `KowalskiPortfolioMappers`.
   - Add a preview/mock implementation following the `IS_UI_TESTING_FAIL_CREATE_ENTRY` pattern (e.g. `IS_UI_TESTING_FAIL_LIST_ENTRIES` flag in `KowalskiEnvironment`).

9. **Extend `KowalskiPortfolio` with entries state and fetch**
   - Add `var entries: [PortfolioEntry]` (using the existing or a new local domain model).
   - Add `var isFetchingEntries: Bool` for loading state.
   - Add `fetchEntries() async` that calls `client.listEntries()`, maps results, and updates `entries`.
   - After a successful `storeTransaction()`, call `fetchEntries()` again so the list refreshes automatically.

10. **Implement `KowalskiPortfolioScreen` as a list view**
    - Replace the placeholder body with a SwiftUI `List` over `portfolio.entries`.
    - Each row: stock symbol, stock name, transaction type, amount, transaction date.
    - Empty state: descriptive label when `entries` is empty and loading is done.
    - Loading state: `ProgressView` while `portfolio.isFetchingEntries` is true on first load.
    - Trigger `await portfolio.fetchEntries()` in a `.task` modifier.
    - Keep the existing `+` toolbar button / `NavigationLink` to `KowalskiPortfolioTransactionScreen` unchanged.

11. **Write a UI test for the list entries success case**
    - Add a test to `app/KowalskiUITests/KowalskiPortfolioUITests.swift` following the existing pattern in that file.
    - Add an `IS_UI_TESTING_LIST_ENTRIES` environment flag (alongside `IS_UI_TESTING_FAIL_CREATE_ENTRY`) in `KowalskiEnvironment` to control what the mock `listEntries()` returns.
    - The mock should return at least one pre-seeded entry when `IS_UI_TESTING_LIST_ENTRIES` is active.
    - The test should:
      1. Launch the app with `.isUiTesting` and the new list-entries flag enabled.
      2. Assert that at least one entry row is visible (query by the stock name or symbol text rendered in each row).
    - The failure case (empty list or error) does not need a UI test in v1, but the mock infrastructure should make it easy to add later.

12. **Verify app builds and tests pass**
    - Run `swift build` in `app/KowalskiFeatures` and `app/KowalskiClient` after changes.
    - Run `just ready` to confirm the full suite (server integration tests + Swift client tests + UI tests) passes.

## Notes / Risks

- The generated `openapi.yaml` in `KowalskiClient` already shows `POST /app-api/portfolio/entries` on the plural path. Verify whether the server-side route has already been renamed or whether only the client artifact was regenerated from an intermediate state. The server route file is the authoritative source.
- Because the current create-entry handler is mocked, list-endpoint tests should not rely on it for setup; otherwise the tests would exercise fake behavior rather than persistence.
- `portfolio_transaction.transaction_date` is stored as a database `date`, while the API currently uses datetime strings; implementation should define and test the exact serialization behavior instead of relying on incidental conversions.
- If implementation reveals no existing concept of a persisted default portfolio, the smallest safe behavior is to return an empty array at runtime and create test helpers that seed a portfolio directly, rather than silently inventing portfolios during reads.
- `KowalskiPortfolioClientCreateEntryResponse` is currently used in `KowalskiPortfolioTransactionScreen` via `storeTransaction()`. Renaming it (todo 7) is a refactor across at least `KowalskiClient`, `KowalskiFeatures`, and any mappers — coordinate this before adding the new list method to avoid a mid-PR name collision.
- The app uses `@Observable` (Observation framework), not `ObservableObject`. Ensure `entries` and `isFetchingEntries` are plain stored properties on the `@Observable` class, not `@Published` wrappers.
