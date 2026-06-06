# Portfolio Dashboards And Growth Chart

## Summary

Add a portfolio dashboards screen reachable by making the home screen “Holdings Net Worth” section a tappable navigation target. The first dashboard will be “Portfolio Growth Over Time”, rendered with Apple Swift Charts and backed by a new server response that returns sparse portfolio-value snapshots only for transaction dates, plus a final current-value point using existing overview/current-price behavior.

## Key Changes

- Add `GET /app/api/portfolio/dashboards` returning:
  - `portfolio_growth_over_time.currency`
  - `portfolio_growth_over_time.points[]` with `date`, `value`, and `is_current`
- Build growth points server-side from the signed-in user’s owned portfolio entries:
  - Resolve splits the same way overview does.
  - Sort transactions by date ascending.
  - Use unique transaction date-only values as snapshot dates.
  - For each snapshot date, carry forward all holdings active on that date and sum `shares_held * close_price`.
  - Include today as a final point using existing current portfolio values; merge with an existing same-day transaction point instead of duplicating the date.
- Reuse `stock_info` for historical close caching; no migration needed.
  - Read cached prices first.
  - Fetch only missing ticker/date snapshot prices via `yahooFinance.chart(..., interval: "1d")`.
  - For non-trading transaction dates, use the latest available market close on or before that snapshot date from a bounded lookback.
  - Convert quote currencies to the user’s preferred currency using the same latest FX snapshot convention already used by overview and preferred purchase prices.
- Add server route, handler, service, repository helpers, Zod/OpenAPI schemas, and Yahoo chart wrapper/mock coverage following the existing portfolio feature structure.
- Run `just download-spec`, then update `KowalskiClient` wrapper models/mappers/protocol with `getDashboards()` and preview data.
- In `KowalskiPortfolio`, store dashboard loading/error/data state and fetch dashboards when the dashboard screen appears.
- Add `KowalskiPortfolioDashboardsScreen` under the portfolio feature:
  - Use `import Charts`.
  - Render a `Chart` with `LineMark` and `PointMark`.
  - Respect money privacy by masking chart values/summary labels when money values are hidden.
  - Show loading, empty, and error states consistent with existing portfolio screens.
- Update `KowalskiPortfolioNavigationPathItem` with `.dashboards` and wrap the net worth card in a plain `NavigationLink`/button affordance.

## Test Plan

- Server integration tests:
  - Returns growth points only for transaction dates plus current point.
  - Carries forward other active holdings at each transaction date.
  - Uses cached `stock_info` prices without calling Yahoo.
  - Calls Yahoo chart only for missing snapshot dates, not full daily history.
  - Excludes other users’ portfolio transactions.
  - Handles no entries with an empty points array.
- Client tests:
  - Maps dashboard OpenAPI response into client response models.
  - Handles unauthorized/internal-server errors consistently with overview.
- Feature tests:
  - `KowalskiPortfolio` loads dashboard state, reports loading/error/empty states, and preserves privacy masking behavior.
- Verification:
  - `swift build` in affected app packages.
  - `just test`.
  - `just ready` last.

## Assumptions

- The first dashboard is portfolio total value over time, not per-holding growth.
- The chart should include a final current-value point; this uses existing current overview price behavior and does not add historical Yahoo calls.
- Historical FX conversion follows the current app convention of using the latest stored preferred-currency FX snapshot.
- No links or runtime dependency on the temporary analysis project will remain.
