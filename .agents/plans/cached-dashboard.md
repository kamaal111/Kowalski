# Cache Portfolio Dashboards In Library/Caches

## Summary

Cache dashboard payloads as Codable JSON files in `Library/Caches`, not `UserDefaults`. The cache is invalidated by a deterministic transaction hash and bounded by using one overwritten file per user, currency, and dashboard period.

## Key Changes

- Add a dashboard cache store backed by `FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)`.
- Store files under a Kowalski-specific cache subdirectory.
- Use deterministic filenames based on:
  - session email
  - currency code
  - dashboard period
- Store one cache file per period for each user/currency scope. New data overwrites the existing file for that period instead of creating additional files.
- Cache record shape:
  - `sessionEmail: String`
  - `currencyCode: String`
  - `period: KowalskiPortfolioDashboardPeriod`
  - `transactionHash: String`
  - `dashboards: PortfolioDashboards`
  - `cachedAt: Date`
- Make dashboard data objects `Codable`.
- Keep `UserDefaults` only for small preferences like dashboard period.
- Compute a stable SHA-256 transaction hash using `CryptoKit` over a canonical sorted transaction representation.

## Cleanup

- Do not append new cache entries. Every dashboard refresh overwrites the same scoped period file.
- On cache read, delete corrupt or undecodable cache files immediately.
- On cache write, ensure the cache directory contains at most one file for the active user/currency/period.
- Because the filename includes period, the normal maximum for one user/currency scope is the number of dashboard periods.
- The OS may also purge `Library/Caches`; missing cache files must be treated as a normal cache miss.

## Dashboard Behavior

- On dashboard fetch:
  - Compute the current transaction hash from `entries`.
  - If the matching cache file exists and the hash matches, hydrate `dashboards` and skip the dashboard API call.
  - If the matching cache file exists but the hash differs, show cached dashboard data immediately, show a refresh hint, fetch fresh dashboard data, then overwrite the same cache file.
  - If no cache file exists, use the existing loading state and fetch from the API.
- On dashboard period change:
  - Persist the selected period as today.
  - Load the selected period’s cache when present.
  - Fetch only when the selected period has no matching fresh cache or has stale cache.
- In `KowalskiPortfolioDashboardsScreen`, always call `portfolio.fetchDashboards()` from `.task`; let the model decide whether cached data is fresh.

## UI

- Add `KowalskiPortfolio.isShowingDashboardRefreshHint`.
- Show a caption-style hint above the dashboard chart when stale cached data is visible and a fresh request is running:
  - Text: `Updating dashboards...`
  - Match the homepage hint styling and accessibility pattern.

## Tests

- Fresh dashboard fetch writes one scoped period cache file.
- Repeated fetch with unchanged transactions reads cache and skips `getDashboards`.
- Changed transactions show cached dashboards, expose the refresh hint while fetching, then overwrite the same cache file.
- Period changes hydrate the matching period cache or fetch when missing/stale.
- Corrupt cache files are deleted and replaced by a successful fresh fetch.
- Cache filenames are scoped by session email, currency, and period.

## Verification

- Run `just test-app` while iterating.
- Run `swift build` in `app/KowalskiFeatures` if package build feedback is needed.
- Run `just ready` as the final verification for code changes.

## Assumptions

- Dashboard cache is derived data and can be safely deleted.
- “Period files only” cleanup is preferred: no age-based pruning and no global count pruning.
- The existing homepage snapshot remains unchanged for now.
