# Consolidate Portfolio Homescreen Data Into `/overview`

## Summary

Replace the homescreen’s split portfolio reads with a single overview flow.

The server will remove `GET /portfolio/entries` and `GET /portfolio/holdings`, move preflight to `GET /portfolio/overview/preflight`, and expand `GET /portfolio/overview` so it returns everything the app needs for the homescreen in one response: resolved transactions, current values, aggregated holdings, and net worth.

## Key Changes

- Server API:
  - Change `GET /portfolio/overview` response schema to include:
    - `transactions`
    - `current_values`
    - `holdings`
    - `net_worth`
  - Add `GET /portfolio/overview/preflight` using the existing holdings-preflight behavior and payload.
  - Remove route registration, handlers, services, and integration tests for:
    - `GET /portfolio/entries`
    - `GET /portfolio/holdings`
  - Rename or relocate the existing preflight route/handler/service names from `holdings-preflight` to `overview-preflight` so logs, route descriptions, and OpenAPI names all match the new namespace.
  - Keep the preflight response shape unchanged unless required by generated naming updates.

- Server implementation:
  - Refactor the portfolio overview service to produce one combined result instead of separate “overview” and “holdings” fetch paths.
  - Reuse the existing split-resolution, preferred-currency, current-price, and holdings aggregation logic rather than duplicating it.
  - Keep holdings sorting, net-worth calculation, zero-holding filtering, FX conversion behavior, and user ownership behavior identical to today’s `GET /holdings`.
  - Update structured log event names from `portfolio.holdings.*` preflight route events to `portfolio.overview.preflight.*`; use `portfolio.overview.retrieved` for the expanded overview payload and include counts for both transactions and holdings.

- App and generated client:
  - Regenerate the OpenAPI spec and Swift client inputs after the API contract changes.
  - Remove `listEntries()`, `getHoldings()`, and `getHoldingsPreflight()` from the portfolio client interface and replace preflight with `getOverviewPreflight()`.
  - Update the Swift portfolio feature bootstrap and refresh flow to:
    - preflight via `/overview/preflight`
    - fetch only `/overview`
    - map the single overview response into `entries`, `holdings`, and `netWorth`
  - Extend `KowalskiPortfolioOverviewResponse` and the client mapper to include `holdings` and `netWorth`.
  - Remove now-unused app-side helper paths that separately map holdings or derive state from two endpoint calls.

## Public Interfaces

- `GET /app-api/portfolio/overview`
  - New response fields: `holdings`, `net_worth`
  - Existing fields stay: `transactions`, `current_values`

- `GET /app-api/portfolio/overview/preflight`
  - Same payload semantics as current holdings preflight:
    - `refresh_state`
    - `poll_after_ms`
    - `latest_cached_price_date`

- Removed endpoints:
  - `GET /app-api/portfolio/entries`
  - `GET /app-api/portfolio/holdings`
  - `GET /app-api/portfolio/holdings/preflight`

- Swift client types:
  - `KowalskiPortfolioOverviewResponse` gains `holdings` and `netWorth`
  - holdings-preflight response/type names should be renamed to overview-preflight equivalents if codegen or wrappers expose route-specific names

## Test Plan

- Server integration coverage:
  - `/overview` returns the same resolved transactions as before
  - `/overview` returns the same holdings and net worth as the old holdings route
  - `/overview` preserves FX conversion behavior
  - `/overview` preserves split-resolution behavior
  - `/overview` returns empty transactions, empty holdings, and zero net worth for empty portfolios
  - `/overview/preflight` preserves ready vs refreshing behavior, polling interval, refresh coordination, and user isolation
  - removed route tests for `/entries` and `/holdings` are replaced by equivalent `/overview` assertions

- App and client tests:
  - portfolio bootstrap preflights through overview namespace
  - portfolio refresh uses one overview fetch instead of parallel holdings plus entries fetches
  - overview mapping populates entries, holdings, and net worth correctly
  - polling behavior still waits until preflight is ready before fetching overview
  - create, update, and import flows still refresh portfolio state correctly via overview

- Verification commands after implementation:
  - `just download-spec`
  - narrow compile/test commands while iterating
  - `just ready` last

## Assumptions

- Homescreen consumers should rely on one canonical overview payload after preflight, not derive holdings client-side.
- Removing the old endpoints is acceptable immediately within this repo’s server and app pair; no separate backward-compat window is needed.
- Non-homescreen entry mutations stay on existing create, bulk-create, and update routes.
