# Dashboard Period Picker And API Windowing

## Summary

Add a locally persisted dashboard period selection to the Swift app, send it as a `/app-api/portfolio/dashboards` query parameter, and have the server return growth data for that selected period. Default period is `1y`. The server caps returned growth points at a configurable `50` points.

## Key Changes

- Add a server dashboard period query schema with values:
  `1w`, `1m`, `3m`, `6m`, `ytd`, `1y`, `2y`, `5y`, `10y`, `all`.
- Default missing query param to `1y`; reject invalid values through the existing OpenAPI/Zod route validation path.
- Define `MAX_PORTFOLIO_DASHBOARD_GROWTH_POINTS = 50` in the portfolio dashboard service/constants area.
- Compute period start dates relative to the current UTC date:
  `1w`, `1m`, `3m`, `6m`, `1y`, `2y`, `5y`, `10y` subtract calendar units; `ytd` starts January 1 of the current UTC year; `all` has no lower bound.
- Include a baseline point at the selected period start when holdings existed before that date, then include transaction-date points inside the period plus the current point.
- Downsample non-current historical points after period filtering so the response has at most 50 total points, always preserving the baseline point when present and the current point when entries exist.

## App And Client

- Run `just download-spec` after updating the server route so `app/KowalskiClient/Sources/KowalskiClient/openapi.yaml` reflects the new query parameter.
- Add a public Swift client enum, e.g. `KowalskiPortfolioDashboardPeriod`, mapping app cases to generated query values.
- Change `KowalskiPortfolioClient.getDashboards()` to accept `period: KowalskiPortfolioDashboardPeriod`; previews can ignore the value.
- In `KowalskiPortfolio`, add `dashboardPeriod`, defaulting to `.oneYear`, persisted with `@UserDefaultsValue` under the portfolio module key. Do not add database persistence.
- Add a `setDashboardPeriod(_:)` method that updates UserDefaults, clears/stages dashboard state as needed, and refetches dashboards for the new period.
- Add a segmented picker to `KowalskiPortfolioDashboardsScreen`, bound to `portfolio.dashboardPeriod`, with labels:
  `1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `2Y`, `5Y`, `10Y`, `All`.
- Keep dashboard loading, error, empty, and money-privacy behavior unchanged.

## Tests

- Server integration tests:
  - default request behaves as `period=1y`;
  - explicit period filters out older transaction snapshots;
  - period baseline is returned when holdings existed before the period start;
  - `all` returns unbounded historical snapshots;
  - returned point count is capped at 50 and keeps current;
  - invalid period returns the existing validation/bad-request behavior.
- Swift client tests:
  - `getDashboards(period: .oneYear)` sends `?period=1y`;
  - another period such as `.yearToDate` maps to `ytd`;
  - existing dashboard decode/error tests still pass.
- Feature tests:
  - dashboard period defaults to `.oneYear`;
  - changing the period persists across portfolio instances;
  - fetching dashboards passes the current period to the portfolio client mock.

## Verification

- Run targeted server dashboard integration tests while iterating.
- Run `just download-spec` after server contract changes.
- Run affected Swift package tests/builds for `KowalskiClient` and `KowalskiFeatures`.
- Run `just test` for cross-stack behavior coverage.
- Run `just ready` last before reporting completion.
