# Portfolio preferred-currency entry values

## Problem

`GET /app-api/portfolio/entries` currently returns each entry's original `purchase_price`, but not the same value converted into the signed-in user's preferred currency. Because of that, the app's portfolio net-worth flow still has to look up the effective currency and fetch ForexKit rates to convert mixed-currency entries client-side before summing them.

## Current state

- The portfolio list route is `server/src/portfolio/routes/list-entries.ts`, with response mapping in `server/src/portfolio/handlers/list-entries.ts`, persistence in `server/src/portfolio/repositories/list-entries.ts`, and response schemas in `server/src/portfolio/schemas/responses.ts`.
- The current list response is `ListEntriesResponseSchema`, which is an array of the same entry shape used by create-entry responses.
- User preferred currency already exists in the auth/session layer via `server/src/auth/middleware.ts`, `server/src/auth/repositories/preferences.ts`, and `server/src/auth/schemas/responses.ts`.
- Server-side FX data already exists in `server/src/forex/**`, including an app-facing latest-rates endpoint backed by stored exchange-rate snapshots.
- The app currently maps list-entry responses into `PortfolioEntry` models and computes net worth in `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift` by converting mixed currencies with ForexKit.

## Proposed approach

1. Extend the portfolio entry response contract with a new money-shaped field for the entry value in the user's preferred currency.
2. Resolve the signed-in user's preferred currency inside the list-entries flow and compute the converted value server-side from stored FX data when needed.
3. Keep the existing `purchase_price` unchanged and additive; the new field should be a sibling property with the same `{ currency, value }` structure.
4. Propagate the contract change through the OpenAPI download + generated Swift client.
5. Update the app portfolio mapping and net-worth calculation to consume the converted field so the total becomes a simple signed sum.

## Todos

1. **Define the API contract**
   - Update `server/src/portfolio/schemas/responses.ts` so list-entry responses include the new money-shaped field.
   - Reuse the existing portfolio money schema instead of duplicating a second money shape.
   - Decide whether the field should live only on list responses or on the shared entry schema used by create/update responses as well.

2. **Add server-side preferred-currency conversion**
   - Extend the list-entries handler/service/repository flow to resolve the signed-in user's preferred currency and compute the converted entry value.
   - Reuse existing preferred-currency lookup patterns from auth instead of inventing a new session source.
   - Reuse stored FX data in `server/src/forex/**`; avoid introducing client-style live ForexKit fetching in the server request path.
   - Define explicit behavior for cases where preferred currency is missing or no usable FX snapshot exists.

3. **Cover the behavior with integration tests**
   - Extend `server/src/portfolio/tests/list-entries.integration.test.ts` for same-currency, mixed-currency, missing-preference, and FX-unavailable scenarios.
   - Keep parsing responses with production Zod schemas.

4. **Regenerate and adapt the Swift client**
   - Run `just download-spec` so the OpenAPI-generated surface includes the new field.
   - Update `app/KowalskiClient/**` mapping/response types as needed, especially `KowalskiPortfolioClientEntryResponse` and `KowalskiPortfolioMapper`.

5. **Simplify app portfolio net-worth logic**
   - Extend the app portfolio entry model/mappers to expose the server-provided preferred-currency money value.
   - Replace the mixed-currency ForexKit conversion path in `KowalskiPortfolio.swift` with a simple signed sum over the server-provided preferred-currency values.
   - Update portfolio tests that currently assert ForexKit-driven conversion behavior.

6. **Validate end-to-end**
   - Narrow checks while iterating: `just compile-server`, `just typecheck`, `just test`.
   - Final verification before completion: `just ready`.

## Notes and assumptions

- Recommended response field name: `preferred_currency_purchase_price`, to match the existing snake_case API style and to make the meaning explicit.
- Recommended fallback behavior: make the new field nullable when the user's preferred currency is unknown or the server cannot derive a conversion from stored FX data, rather than silently defaulting to another currency.
- Scope confirmed: the eventual implementation should be end-to-end, including the server contract, OpenAPI/client regeneration, and the app net-worth simplification.
