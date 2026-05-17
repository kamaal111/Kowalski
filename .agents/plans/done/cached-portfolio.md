# Implement Cached-First Portfolio Bootstrap With Configurable Holdings Preflight Polling

## Summary

Build a two-phase portfolio bootstrap flow:

1. The app immediately hydrates the last cached portfolio snapshot from local storage and renders it.
2. The app calls a new server preflight endpoint to ask whether daily prices are already ready or are currently being refreshed.
3. If preflight says `ready`, the app fetches fresh holdings + entries immediately.
4. If preflight says `refreshing`, the app shows a small inline “updating latest prices” message, polls preflight, and fetches fresh holdings + entries only after preflight flips to `ready`.

Use a configurable poll interval defined in config, not a hardcoded value. The server should source the polling recommendation from configuration and return it to the app in the preflight response so the interval can be adjusted centrally later.

## Implementation Changes

### 1. Server: add a holdings preflight contract

Add a new portfolio route under the existing authenticated portfolio router:

- Path: `GET /app-api/portfolio/holdings/preflight`
- Route module: add a new route/handler/service alongside the existing portfolio route files.
- Route contract response body:
  - `refresh_state: "ready" | "refreshing"`
  - `poll_after_ms: number | null`
  - `latest_cached_price_date: string | null`

Behavior:

- Resolve the authenticated user through the existing portfolio auth middleware.
- Reuse the same portfolio-entry query path already used by holdings:
  - load entries with `findPortfolioEntriesByUserId`
  - resolve splits with `resolveSplits`
  - dedupe active ticker ids
- If there are no active entries:
  - return `ready`
  - `poll_after_ms = null`
  - `latest_cached_price_date = null`
- If all active tickers already have a `stock_info` row for the current UTC date:
  - return `ready`
  - `poll_after_ms = null`
  - `latest_cached_price_date = current UTC date`
- If at least one active ticker is missing a current-date row:
  - consult a refresh coordinator keyed by authenticated user + current UTC date
  - if no refresh is running yet, start one in the background
  - return `refreshing`
  - `poll_after_ms = env.PORTFOLIO_HOLDINGS_PREFLIGHT_POLL_INTERVAL_MS`
  - `latest_cached_price_date = latest known resolved price date across the active ticker set, if any`

Important: preflight is not responsible for returning stale holdings data. It only coordinates refresh readiness.

### 2. Server: add configurable polling to env/config

Add a dedicated environment/config entry for the preflight poll interval in the existing server config flow.

Implementation details:

- Define a new env variable in the server env schema, e.g. `PORTFOLIO_HOLDINGS_PREFLIGHT_POLL_INTERVAL_MS`
- Validate it as a positive finite integer
- Expose it through the existing `env` object used by server modules
- Add it to `.env.example` with a sane default
- Use this value only when preflight returns `refreshing`

Default:

- `1500` ms unless there is already a repo-standard polling interval constant that should be reused

The app should not own the polling interval. It should trust the value returned by preflight.

### 3. Server: add a process-local refresh coordinator

Add a dedicated coordinator module under portfolio services or internals.

Responsibility:

- prevent multiple overlapping Yahoo refreshes for the same user/day
- remember whether a same-day refresh attempt already completed

Suggested internal shape:

- module-scoped `Map<string, RefreshState>`
- key format: `${userId}:${utcDate}`
- `RefreshState` fields:
  - `promise: Promise<void> | null`
  - `completedAt: Date | null`
  - `startedAt: Date | null`

Coordinator API:

- `getStatus(key): "idle" | "refreshing" | "completed"`
- `runOnce(key, task): Promise<"started" | "reused" | "completed">`
- `clearExpiredStates(currentUtcDate)` or simple opportunistic cleanup by removing keys not matching current UTC date

Rules:

- if state has an in-flight promise, reuse it and report `refreshing`
- if state already completed for the same UTC date, treat preflight as `ready` even if the newest DB price is still from a prior market day
- once the task settles, clear `promise` and set `completedAt`
- do not throw preflight into failure just because the background refresh failed; log it and mark the daily attempt completed so the app does not poll forever

This is intentionally process-local for v1.

### 4. Server: extract reusable “refresh missing daily prices” logic

Refactor the existing current-value logic so the Yahoo refresh part can be reused by both:

- `GET /holdings`
- the background task triggered by preflight

Current code path in `current-stock-values.ts` mixes:

- checking current-date DB rows
- calling Yahoo
- inserting new stock rows
- falling back to latest stored rows
- converting to preferred currency
- assembling final response values

Split that into smaller functions:

- `findResolvedAndMissingDailyPrices(c, entries, today)`
  - returns:
    - `resolvedTodayPrices`
    - `missingEntries`
- `refreshMissingDailyPrices(c, missingEntries, today)`
  - fetch Yahoo quotes in batch
  - write any new rows via `insertStockPrices`
  - log outcome
  - return inserted/resolved rows
- `resolveCurrentStockValues(c, entries)`
  - keeps current end behavior for holdings
  - uses the helpers above
- `refreshPortfolioDailyPrices(c, entries)`
  - used only by preflight background task
  - performs Yahoo refresh + insert side effects
  - does not build holdings response

Keep the current holdings endpoint semantics unchanged in v1 so existing behavior remains safe.

### 5. Server: add latest cached price date lookup

Add repository support to compute the newest cached price date among active ticker ids.

New repository helper under stock prices repository:

- input: `tickerIds: string[]`
- output: `string | null`

Use it in preflight response only for observability/debuggability. The app does not need to reason on the date.

### 6. Server: logging and failure policy

Add new structured events:

- `portfolio.holdings.preflight.checked`
- `portfolio.holdings.preflight.refresh.started`
- `portfolio.holdings.preflight.refresh.reused`
- `portfolio.holdings.preflight.refresh.completed`
- `portfolio.holdings.preflight.refresh.failed`

Fields to include:

- `user_id`
- `ticker_count`
- `missing_today_count`
- `refresh_state`
- `poll_after_ms`
- `latest_cached_price_date`
- `outcome`

Failure policy:

- if background Yahoo refresh fails, log the failure and mark the daily attempt complete for that user/date
- preflight should still return `ready` on later polls for that same day, so the app stops polling and then performs its normal full fetch
- the normal full fetch still falls back to latest stored prices as it does today

### 7. OpenAPI: add preflight schema and regenerate client

Add new response schema in `server/src/portfolio/schemas/responses.ts`:

- `PortfolioHoldingsPreflightResponseSchema`

Add new route file:

- `server/src/portfolio/routes/holdings-preflight.ts`

Wire it in:

- `server/src/portfolio/routes/index.ts`

Then regenerate client:

- `just download-spec`

Client changes required:

- add protocol method to `KowalskiPortfolioClient`:
  - `func getHoldingsPreflight() async -> Result<KowalskiPortfolioHoldingsPreflightResponse, KowalskiPortfolioClientHoldingsPreflightErrors>`
- add new response model in `KowalskiClient`
- add new error enum
- add mapping in `KowalskiPortfolioMapper`
- add preview/testing support in `KowalskiPortfolioClientPreview`

### 8. App: make portfolio cacheable and explicit

Persist a full cached portfolio snapshot in the feature layer.

Add `Codable` conformance to the portfolio types that are part of the persisted snapshot:

- `Money`
- `PortfolioHolding`
- `PortfolioAsset`
- `PortfolioEntry`
- `Stock`
- `TransactionType`
- `AllTimeProfit` if stored directly, or recompute instead

Recommendation:

- persist entries, holdings, and net worth
- recompute `allTimeProfit` after hydration using the same existing method

Add a new persisted wrapper type:

- `CachedPortfolioSnapshot: Codable`
- fields:
  - `sessionEmail: String`
  - `currencyCode: String`
  - `entries: [PortfolioEntry]`
  - `holdings: [PortfolioHolding]`
  - `netWorth: Money?`
  - `cachedAt: Date`

Add a new `@UserDefaultsObject` property on `KowalskiPortfolio`, similar to auth.

Cache scoping:

- use auth session email + effective currency
- reason: holdings values are currency-sensitive, and the app session exposes email reliably today

Add helper methods on `KowalskiPortfolio`:

- `hydrateCachedSnapshotIfAvailable(sessionEmail: String?, currencyCode: String)`
- `persistCachedSnapshot(sessionEmail: String?, currencyCode: String)`
- `clearCachedSnapshotIfScopeMismatches(...)`
- `resetPersistedSnapshot()` for tests

### 9. App: extend portfolio feature state for bootstrap orchestration

Add state to `KowalskiPortfolio`:

- `private(set) var isRefreshingLatestPrices = false`
- `private(set) var hasHydratedCachedSnapshot = false`

Keep `isLoading` for hard cold starts only.

Add a new bootstrap entry point replacing the current raw `fetchOverview()` call from the screen:

- `bootstrapPortfolio(sessionEmail: String?, currencyCode: String) async`

Detailed flow:

1. Hydrate cached snapshot if one exists for the current scope.
2. If cache exists:
   - set `hasHydratedCachedSnapshot = true`
   - populate `entries`, `holdings`, `netWorth`
   - recompute `allTimeProfit`
   - do not set `isLoading = true`
3. If no cache exists:
   - continue using the current loading behavior
4. Call `client.portfolio.getHoldingsPreflight()`
5. Handle preflight:
   - `.ready`:
     - set `isRefreshingLatestPrices = false`
     - call the existing full refresh path
   - `.refreshing`:
     - set `isRefreshingLatestPrices = true`
     - poll preflight using `poll_after_ms`
     - when it flips to `ready`, set `isRefreshingLatestPrices = false` and call full refresh
6. After a successful full refresh:
   - recompute profit
   - persist cached snapshot
7. If preflight fails:
   - if cached snapshot exists, keep showing it and run one best-effort full refresh in background
   - if no cache exists, fall back to current blocking full refresh path

### 10. App: polling helper must respect server-provided config

Add a dedicated polling helper:

- `waitUntilHoldingsReady(sessionEmail: String?, currencyCode: String) async -> Result<Void, Error>`

Polling rules:

- use `poll_after_ms` returned by the server
- if preflight returns `refreshing` with `poll_after_ms == null`, fall back to a small local default only as a defensive guard
- the authoritative interval is the server-provided config-backed value
- stop polling when response becomes `ready`
- hard cap retries at a small number, e.g. 8 attempts
- if the cap is reached, stop polling, clear the refresh hint, and run one normal full refresh anyway

This gives you runtime adjustability by changing server config rather than shipping a new app just to tweak the interval.

### 11. App: keep full refresh path focused and reusable

Retain one internal method for the existing “truth fetch”:

- fetch holdings and entries in parallel
- update in-memory state
- recompute all-time profit
- persist cache

Suggested split:

- `fetchOverview()` remains public-facing compatibility wrapper if needed
- `refreshFromServer(sessionEmail: String?, currencyCode: String) async -> Result<Void, Error>`
- all mutation paths continue calling this direct refresh method after create/update/import

This avoids mixing preflight orchestration into transaction mutation flows.

### 12. App UI: update the portfolio screen bootstrap and hint

In `KowalskiPortfolioScreen`:

- replace the current `.task { await handleFetchOverview() }` bootstrap with `bootstrapPortfolio(...)`
- read `auth.session?.email` and `auth.effectiveCurrency`
- keep the one-time `hasLoadedEntries` guard

Rendering changes:

- keep the existing full-screen loading state only when:
  - `portfolio.isLoading == true`
  - `portfolio.entries.isEmpty`
  - `portfolio.holdings.isEmpty`
  - and no cached snapshot was hydrated
- if cached snapshot is present, render content immediately

Add a small inline top message above `netWorthCard` when `portfolio.isRefreshingLatestPrices` is true:

- text: `Updating latest prices…`
- secondary styling, lightweight banner or caption row
- no spinner-heavy blocking UI
- no toast

Currency change behavior:

- on `auth.effectiveCurrency` change, rerun `bootstrapPortfolio(...)`
- this allows immediate render from currency-scoped cache if present, otherwise normal refresh

### 13. Preview and test doubles

Extend `MockPortfolioClient` in portfolio tests:

- add preflight result queue
- add call counter for preflight
- support sequences like:
  - first preflight `refreshing`
  - second preflight `ready`

Add client preview support if needed for Swift previews:

- a preview preflight state that can simulate background refresh message

## Test Plan

### Server integration tests

Add a new integration suite for holdings preflight.

Cases:

- returns `ready` when portfolio is empty
- returns `ready` when all active tickers already have current UTC date prices
- returns `refreshing` when at least one active ticker is missing today’s price
- starts only one Yahoo refresh when multiple preflight calls race for the same user/day
- returns `ready` after the same-day refresh attempt completes even if Yahoo returned no new quotes
- does not leak refresh coordination across users
- returns configured `poll_after_ms` value when in `refreshing` state

### Server unit tests

If the refresh coordinator is isolated enough, unit test:

- first `runOnce` starts task
- concurrent `runOnce` reuses task
- completed same-day state returns completed
- cleanup of old-day keys works

Add env/config tests if there is existing env schema coverage:

- valid positive integer interval parses
- invalid interval is rejected

### Client tests

Add `KowalskiClient` tests for:

- preflight `200 OK` mapping
- unauthorized mapping
- undocumented error mapping
- preflight response includes `poll_after_ms`
- preview/testing client behavior for preflight

### Portfolio feature tests

Add focused `KowalskiPortfolioTests` for:

- cached snapshot hydrates state before any network refresh completes
- bootstrap with no cache sets loading and fetches server data
- bootstrap with cache + preflight `ready` refreshes once and updates cache
- bootstrap with cache + preflight `refreshing` keeps content visible and polls until ready
- bootstrap uses the server-provided `poll_after_ms`
- preflight failure keeps cached content and attempts one direct refresh
- successful direct refresh persists the latest snapshot
- currency-scoped cache prevents cross-currency reuse
- transaction create/update/import still call the direct refresh path rather than preflight

### UI test

Add one targeted UI test scenario:

- seed cached portfolio snapshot
- launch portfolio screen
- verify cached holdings are visible without waiting for the full-screen loader
- verify the “Updating latest prices…” hint appears when preflight is refreshing
- verify fresh values eventually replace cached values once preflight becomes ready

## Verification

Implementation verification should run in this order:

1. focused server tests for preflight
2. focused Swift package tests for portfolio feature/client mapping
3. `just test`
4. `just ready`

## Assumptions And Defaults

- Preflight endpoint path is `/app-api/portfolio/holdings/preflight`.
- Preflight state machine is intentionally small: only `ready` and `refreshing`.
- Poll interval is configured on the server through env/config and returned to the app in `poll_after_ms`.
- App uses the server-provided polling interval instead of a hardcoded local one.
- Cache scope is `session email + effective currency`.
- Full holdings response shape stays unchanged in v1.
- Weekend/holiday handling is intentionally indirect: “same-day refresh attempted already” prevents infinite polling without introducing exchange-calendar logic.
- Process-local refresh coordination is acceptable for v1 and can be upgraded later if deployment topology requires shared locking.
