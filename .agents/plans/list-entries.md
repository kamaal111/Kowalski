## Problem

Add a `list portfolio entries` endpoint for the signed-in user's implicit/default portfolio. The current portfolio surface only exposes `POST /app-api/portfolio/entry`, and that handler is still a canned response rather than DB-backed logic. The implementation plan therefore needs to cover three related changes together: renaming the portfolio-entry collection endpoint to `/app-api/portfolio/entries`, adding the new read endpoint contract on that plural path, and introducing the missing portfolio test-data setup needed to test against real persisted rows.

## Current State

- `server/src/portfolio/routes/index.ts` only registers `create-entry`.
- `server/src/portfolio/routes/create-entry.ts` already establishes the portfolio routing style, auth middleware, and OpenAPI response documentation, but it currently uses the singular `/app-api/portfolio/entry` path that should become plural.
- `server/src/portfolio/handlers/create-entry.ts` is a stub that returns hard-coded data and does not read/write the database.
- `server/src/db/schema/portfolio.ts` defines `portfolio` and `portfolio_transaction`, with transactions belonging to a portfolio and a stock ticker.
- Integration tests use isolated PostgreSQL databases plus authenticated sessions via `server/src/tests/fixtures.ts` and `server/src/tests/utils.ts`.
- The generated client OpenAPI spec currently only includes the create-entry operation on the singular path.

## Agreed Scope

- Portfolio ownership model: a single implicit/default portfolio per signed-in user.
- Endpoint shape: a simple authenticated `GET` returning all entries for that default portfolio in v1, sharing the plural collection path with `POST`.
- No pagination, filtering, or explicit `portfolioId` in v1.

## Proposed Approach

1. Rename the existing create-entry contract from `POST /app-api/portfolio/entry` to `POST /app-api/portfolio/entries`, and add `GET /app-api/portfolio/entries` for listing.
2. Introduce a shared portfolio-entry response schema so the list route and the renamed create route can describe the same entry payload consistently.
3. Add portfolio test-data helpers that create a default portfolio plus associated transactions directly in the test database. This avoids depending on the stubbed create-entry handler for list-endpoint setup.
4. Implement a DB-backed list handler that:
   - resolves the signed-in user from request context,
   - loads that user's default portfolio,
   - queries its transactions and required ticker data,
   - maps DB rows into the public API shape,
   - returns a stable, documented order (recommend newest transaction first, then newest update as a tiebreaker).
5. Regenerate the OpenAPI spec/client artifacts as part of the normal repo workflow so the Swift client stays in sync with the pluralized path and the new GET operation, even if no app code consumes the endpoint yet.

## Todos

1. **Define shared portfolio entry schemas**
   - Extract/reuse a common API schema for a persisted portfolio entry response.
   - Add a list response schema (`z.array(...)`) for the new `GET /app-api/portfolio/entries` route.
   - Keep OpenAPI names/examples consistent with the existing create-entry documentation.

2. **Rename the collection endpoint to plural**
   - Update the existing create-entry route definition from `/app-api/portfolio/entry` to `/app-api/portfolio/entries`.
   - Ensure any plan-following implementation updates the generated spec/client references so no stale singular-path contract remains.
   - Verify tests and docs assert against the plural path only.

3. **Add default-portfolio test helpers**
   - Create reusable helpers for inserting a portfolio for a specific test user and seeding one or more `portfolio_transaction` rows plus referenced ticker rows.
   - Prefer direct DB seeding in tests so list-route setup is deterministic and independent of unfinished write-path logic.

4. **Implement the list route and handler**
   - Add a new route module under `server/src/portfolio/routes/`.
   - Register it in `server/src/portfolio/routes/index.ts`.
   - Implement the handler under `server/src/portfolio/handlers/` using Drizzle queries and explicit row-to-response mapping.
   - Return an empty array when the user has no default portfolio or no entries yet, unless codebase conventions reveal a stronger existing rule during implementation.

5. **Add integration tests using repo best practices**
   - Follow the existing isolated-db `integrationTest` fixture pattern.
   - Cover at minimum:
     - authenticated `GET /app-api/portfolio/entries` returns seeded entries,
     - entries are returned in the documented order,
     - unauthenticated request is rejected,
     - empty state returns `200` with `[]`,
     - user isolation (one user cannot see another user's entries),
     - the renamed `POST /app-api/portfolio/entries` contract still behaves as expected once that handler is made real or otherwise updated as part of the same surface change.
   - Validate response bodies with Zod schemas rather than loose object assertions where practical.

6. **Regenerate and verify**
   - Run the existing repo verification workflow, including `just ready`.
   - Ensure the OpenAPI spec reflects the pluralized path for both `GET` and `POST`, and that generated client code still builds as part of the repo checks.

## Notes / Risks

- Because the current create-entry handler is mocked, list-endpoint tests should not rely on it for setup; otherwise the tests would exercise fake behavior rather than persistence.
- Renaming the existing create route is a contract change, so any generated client call sites or hard-coded API consumers must move off the singular path in the same implementation.
- `portfolio_transaction.transaction_date` is stored as a database `date`, while the API currently uses datetime strings; implementation should define and test the exact serialization behavior instead of relying on incidental conversions.
- If implementation reveals no existing concept of a persisted default portfolio, the smallest safe behavior is to create test helpers now and keep runtime behavior read-only (empty array when none exists) rather than silently inventing portfolios during reads.
