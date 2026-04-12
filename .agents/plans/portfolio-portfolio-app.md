# Portfolio Overview App Wiring

## Summary

Wire `KowalskiPortfolio` to use `GET /app-api/portfolio/overview` as its single read path, keep the existing transaction-list UI, and change the Net Worth card to show current market value instead of cost basis.

This pass should remove the current two-step app flow:

- no separate `fetchEntries()` + `fetchNetWorth(...)`
- no client-side preferred-currency refresh bookkeeping
- no cost-basis math from `preferredCurrencyPurchasePrice`

Instead, the feature should fetch one overview payload, map it once, derive current holdings value from `transactions + current_values`, and refresh that same overview after create/update mutations.

## Key Changes

### 1. Client surface

Update `app/KowalskiClient` to expose the overview endpoint as a first-class portfolio API.

Add:

- `KowalskiPortfolioClient.getOverview() async -> Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors>`
- `KowalskiPortfolioOverviewResponse`
  - `transactions: [KowalskiPortfolioClientEntryResponse]`
  - `currentValues: [String: KowalskiClientMoney]`
- `KowalskiPortfolioClientOverviewErrors`

Implementation details:

- Decode `Operations.GetAppApiPortfolioOverview.Output`
- Map `transactions` through the existing entry mapper
- Map `current_values` into a Swift `[String: KowalskiClientMoney]`
- Treat `401/404` the same way the existing portfolio reads do today
- Keep `listEntries()` in place for compatibility, but stop using it from `KowalskiPortfolio`

Preview/testing support:

- Extend `KowalskiPortfolioClientPreview` so overview reads are configurable
- Preview overview data should stay consistent with preview transaction entries
- The “list failure” preview path should become an overview-read failure path for the portfolio screen

### 2. Feature state and derivation

Refactor `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift` so overview becomes the source of truth.

State:

- Keep `entries: [PortfolioEntry]`
- Keep `netWorth: Double?`
- Keep `isLoading`
- Remove `isLoadingNetWorth`
- Remove `lastPreferredCurrency`
- Remove the old `fetchNetWorth(preferredCurrency:)` flow

Behavior:

- Add `fetchOverview() async -> Result<Void, Error>`
- `fetchOverview()` should:
  - call `client.portfolio.getOverview()`
  - map `transactions` to `[PortfolioEntry]`
  - map `currentValues` to feature `Money`
  - derive `netWorth`
  - update all overview-backed state together on the main actor
- Refresh after `storeTransaction` and `updateTransaction` should call `fetchOverview()`, not `listEntries()`

Current-value net worth rule:

- Build holdings by symbol from transactions:
  - `buy` adds `amount`
  - `sell` subtracts `amount`
  - `split` adjusts holdings by `amount`
- Multiply each symbol’s resulting quantity by that symbol’s `current_values[symbol].value`
- Sum across symbols to get `netWorth`
- Symbols whose net quantity is `0` contribute `0`
- If a required symbol is missing from `current_values`, set `netWorth` to `nil`
- If current-value currencies are mixed, only sum when all contributing values use the same currency; otherwise set `netWorth` to `nil`

### 3. Mappers and models

Keep the transaction UI model intact and add only the overview mapping needed to support the new fetch path.

In `KowalskiPortfolioMappers`:

- add mapping from `KowalskiPortfolioOverviewResponse` pieces into:
  - `[PortfolioEntry]`
  - `[String: Money]`

Keep:

- `PortfolioEntry` as the transaction model for list/detail/edit flows

Do not:

- redesign the screen around positions
- replace transaction detail/edit navigation
- add per-entry unrealized P&L or current-value UI in this pass

### 4. Screen wiring

Update `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift` to use overview reads.

Screen behavior:

- initial `.task` should call `handleFetchOverview()`
- `handleFetchOverview()` should only trigger `portfolio.fetchOverview()`
- `.onChange(of: auth.effectiveCurrency)` should re-fetch overview, because the server overview response is currency-sensitive
- the card title stays `Net Worth`, but its value now reflects current market value
- keep the existing empty state and transaction list layout

Loading behavior:

- preserve the current “full screen loader on first load, card/list once data exists” feel
- do not reintroduce a separate net-worth loading state unless implementation proves it is necessary

### 5. Tests and previews

Update the app/client tests so they assert the new single-read overview behavior.

Client tests:

- add a decode test for `/portfolio/overview`
- verify `transactions` and `current_values` both map correctly
- verify snake_case `current_values` becomes Swift `currentValues`

Feature tests:

- replace old fetch-net-worth tests with overview-based tests
- cover:
  - overview fetch populates entries and current net worth
  - buys and sells on the same symbol produce the expected net quantity
  - split transactions adjust holdings quantity
  - zero-net-quantity symbols contribute zero
  - missing `current_values` for a held symbol yields `netWorth == nil`
  - currency change causes a second overview fetch and updates the total
  - create/update success refreshes overview, not entry-list reads

Preview support:

- portfolio preview should include overview current values so the card renders realistic data
- failing preview should exercise overview fetch failure

## Public APIs / Types

New app-facing interfaces:

- `KowalskiPortfolioClient.getOverview()`
- `KowalskiPortfolioOverviewResponse`
- `KowalskiPortfolioClientOverviewErrors`

Changed feature contract:

- `KowalskiPortfolio.fetchOverview()` becomes the canonical portfolio read method
- `KowalskiPortfolio.fetchNetWorth(preferredCurrency:)` should be removed
- `KowalskiPortfolio` continues exposing `entries`, `isLoading`, and `netWorth` to the UI

## Test Plan

Run, at minimum:

- `just test`
- `just ready`

Targeted assertions to add before final verification:

- client overview decode coverage
- portfolio feature overview refresh coverage
- split-adjusted current-value coverage
- auth-currency-change re-fetch coverage

## Assumptions

- Net Worth should now mean current market value, not cost basis.
- This pass keeps the existing transaction-based UI; no positions screen or extra valuation rows yet.
- Split entries should affect holdings quantity using the recorded `amount`.
- The server overview response remains the source of truth for quote currency; the app should not do Forex conversion itself in this flow.
- If overview data is incomplete or internally inconsistent for a safe sum, the card should show “Net worth unavailable” rather than guessing.
