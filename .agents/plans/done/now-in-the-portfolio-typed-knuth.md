# Progress/Holdings Dashboard Tabs

## Context

The portfolio dashboard screen currently shows only a line graph ("Progress") of portfolio value over time, with a period selector (1W/1M/.../All) above it. The user wants a second view — a pie chart ("Holdings") showing the current distribution of their stock holdings by value — reachable via a tab selector placed above the existing period selector. The selected tab must persist locally across app launches, matching the existing pattern used for the period preference.

Holdings distribution has no time dimension (it's always "current"), so per user decision: **the period selector is hidden when the Holdings tab is active**.

This requires a server response-shape change (the dashboards endpoint gains a new `portfolio_holdings_distribution` field), so the OpenAPI spec must be regenerated and the Swift client rebuilt against it. Full stack: server schema/service/tests, spec regen, and client DTO/mapper/UI/tests.

## Server Changes

**`server/src/portfolio/schemas/responses.ts`** — add a lean schema (no `profit_loss`, no `percentage` — percentage-of-total is computed client-side), following this repo's convention of `.openapi(...)` on every field:

```ts
const PortfolioHoldingDistributionAssetSchema = z.object({
  symbol: z.string().openapi({ description: 'Ticker symbol for the holding.', example: 'AAPL' }),
  name: z.string().openapi({ description: 'Display name for the holding.', example: 'Apple Inc.' }),
}).openapi('PortfolioHoldingDistributionAsset', { ... });

const PortfolioHoldingDistributionItemSchema = z.object({
  asset: PortfolioHoldingDistributionAssetSchema,
  value: CurrentValueSchema, // reuse existing {currency, value} shape
}).openapi('PortfolioHoldingDistributionItem', { ... });

const PortfolioHoldingsDistributionSchema = z.object({
  currency: CurrencyShape,
  holdings: z.array(PortfolioHoldingDistributionItemSchema),
}).openapi('PortfolioHoldingsDistribution', { ... });
```

Add `portfolio_holdings_distribution: PortfolioHoldingsDistributionSchema` to `PortfolioDashboardsResponseSchema`, with an updated `.openapi(...)` example.

**`server/src/portfolio/services/dashboards.ts`** — avoid a duplicate `aggregateHoldings`/`getCurrentStockValues` fetch. `makeCurrentPoint` (~line 225) already computes `currentValues` and folds `aggregateHoldings(entries)` into a single total — extend it (rename to e.g. `makeCurrentPointAndDistribution`) to also return the per-holding breakdown before it gets summed away:

```ts
const distribution = aggregateHoldings(entries)
  .filter(holding => holding.amount !== 0)
  .map(holding => {
    const currentValue = currentValues[holding.entry.stockSymbol];
    if (currentValue == null) throw new StockPriceFetchFailed(c);
    return {
      symbol: holding.entry.stockSymbol,
      name: holding.entry.stockName,
      value: holding.amount * currentValue.value,
    };
  });
const value = distribution.reduce((total, item) => total + item.value, 0);
```

Confirmed: `ResolvedPortfolioEntry` (via `PersistedPortfolioEntry`, joined in `findPortfolioEntriesByUserId`) already carries `stockName` — this is exactly what `services/overview.ts`'s `mapHoldingToResponse` uses (`holding.entry.stockName`), so no extra DB join is needed.

Update `PortfolioDashboardsResult`/return values to include `portfolioHoldingsDistribution: { currency, holdings: distribution }` on both the main path and the empty-entries early return (`holdings: []`).

**`server/src/portfolio/handlers/dashboards.ts`** — add `portfolio_holdings_distribution: result.portfolioHoldingsDistribution` to the response, and a `holding_count` field to the existing `logInfo` event.

## Server Tests

**`server/src/portfolio/tests/dashboards.integration.test.ts`** — extend using existing `seedPortfolioEntry`/`seedStockInfo`/`sendDashboardsRequest`/`expectSuccessfulDashboardsResponse` helpers:

- Holdings distribution reflects current aggregated amount × current price for each seeded stock.
- Empty portfolio → `portfolio_holdings_distribution: { currency: ..., holdings: [] }`.
- Distribution is identical regardless of the `period` query param (only `portfolio_growth_over_time.points` should vary).
- A partially-sold holding nets correctly (no zero/negative-amount entries leak through).

Run via `cd server && npx vitest run src/portfolio/tests/dashboards.integration.test.ts`.

## Spec Regeneration (required step, do not skip)

After the schema change:

```
just download-spec   # regenerates app/KowalskiClient/Sources/KowalskiClient/openapi.yaml
just check-spec      # CI guard — run locally to confirm no drift
```

The Swift OpenAPI generator runs as a build plugin, so building `KowalskiClient` afterward regenerates `Components.Schemas.PortfolioDashboardsResponse` with the new field. Do this **before** writing client mapper code, since the mapper references the generated types.

## Client Changes (4 DTO/mapper layers + UI)

1. **`app/KowalskiClient/Sources/KowalskiClient/Responses/KowalskiPortfolioDashboardsResponse.swift`** — add `portfolioHoldingsDistribution: KowalskiPortfolioHoldingsDistributionResponse { currency, holdings: [KowalskiPortfolioHoldingDistributionItemResponse { symbol, name, value }] }`.
2. **`.../Internals/Mappers/KowalskiPortfolioMapper.swift`** — extend `mapDashboardsApiResponseToClient` with a new `mapPortfolioHoldingDistributionItem(_:)`, reusing the existing money-mapping helper.
3. **`app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/PortfolioDashboards.swift`** — mirror the same shape (`PortfolioHoldingsDistribution`, `PortfolioHoldingDistributionItem`), all `Codable, Hashable`. This is the type persisted by `PortfolioDashboardCache`; since corrupt/undecodable cache files are already discarded and refetched (`cleanUpCorruptFile()`), no cache-versioning work is needed for this shape change.
4. **`.../Internals/Mappers/KowalskiPortfolioMappers.swift`** — extend `mapDashboardsResponse` analogously.
5. **`KowalskiPortfolioClient.swift`** — extend the `.preview()` mock's `makePreviewDashboards()` with 2-3 example holdings (reuse existing preview symbols) so `#Preview` blocks render meaningful pie-chart data.

## Tab Selection State + Persistence

New enum, feature-module-local (pure UI concern, never sent over the network — unlike `KowalskiPortfolioDashboardPeriod` which lives in `KowalskiClient` because it's a query param):

**New file `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/KowalskiPortfolioDashboardTab.swift`**:

```swift
enum KowalskiPortfolioDashboardTab: String, CaseIterable, Codable, Sendable {
    case progress
    case holdings

    var dashboardLabel: LocalizedStringKey {
        switch self {
        case .progress: "Progress"
        case .holdings: "Holdings"
        }
    }
}
```

**`app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`** — mirror the existing `dashboardPeriod` persistence pattern exactly (see `dashboardPeriodPreferenceKey`/`@UserDefaultsValue`/`persistedDashboardPeriod`/`resetPersistedDashboardPeriod()`), adding parallel `dashboardTabPreferenceKey`, `selectedDashboardTab`, `setDashboardTab(_:)`, `resetPersistedDashboardTab()`. Key difference: `setDashboardTab` is **synchronous, non-async**, and does **not** call `fetchDashboards()` — both datasets arrive in one response, so switching tabs is a pure local state flip with no network round trip or loading state.

## Tab Selector View + Screen Wiring

**New file `.../Views/SupportingViews/KowalskiPortfolioDashboardTabPicker.swift`** — structurally like `KowalskiPortfolioDashboardPeriodPicker.swift` but simpler (no `Task`/toast/failure handling, since there's no fetch): a segmented `Picker` bound to `portfolio.selectedDashboardTab`, calling `portfolio.setDashboardTab($0)` directly in the `Binding` setter.

**`KowalskiPortfolioDashboardsScreen.swift`** — insert the tab picker above the period picker; hide the period picker when `.holdings` is selected; branch the chart-or-status content on the selected tab:

```swift
KowalskiPortfolioDashboardTabPicker()

if portfolio.selectedDashboardTab == .progress {
    KowalskiPortfolioDashboardPeriodPicker(dashboardLoadFailed: $dashboardLoadFailed, toast: $toast)
}

// existing loading/error/empty status views unchanged (one fetch backs both tabs)

if portfolio.selectedDashboardTab == .progress, let growth = portfolio.dashboards?.portfolioGrowthOverTime {
    KowalskiPortfolioGrowthDashboardView(growth: growth, showsMoneyValues: portfolio.showsMoneyValues)
} else if portfolio.selectedDashboardTab == .holdings, let distribution = portfolio.dashboards?.portfolioHoldingsDistribution {
    KowalskiPortfolioHoldingsDistributionDashboardView(distribution: distribution, showsMoneyValues: portfolio.showsMoneyValues)
}
```

## New Pie Chart View

**New file `.../SupportingViews/KowalskiPortfolioHoldingsDistributionDashboardView.swift`** — card wrapper matching `KowalskiPortfolioGrowthDashboardView.swift`'s chrome (header + chart-or-`KowalskiPortfolioMaskedChartPlaceholderView` when `!showsMoneyValues`).

**New file `.../SupportingViews/KowalskiPortfolioHoldingsDistributionChartView.swift`** — net-new Swift Charts usage:

```swift
import Charts

struct KowalskiPortfolioHoldingsDistributionChartView: View {
    let distribution: PortfolioHoldingsDistribution

    var body: some View {
        Chart(distribution.holdings, id: \.symbol) { holding in
            SectorMark(
                angle: .value("Value", holding.value.value),
                innerRadius: .ratio(0.55),
                angularInset: 1.5,
            )
            .foregroundStyle(by: .value("Holding", holding.symbol))
        }
        .chartLegend(position: .bottom, alignment: .leading)
        .frame(height: 280)
    }
}
```

Percentage-of-total for legend/labels is computed client-side (`holding.value.value / totalValue`) — not sent by the server.

## Client Unit Tests

**`app/KowalskiFeatures/Tests/KowalskiPortfolioTests/KowalskiPortfolioTests.swift`** — mirror the existing period tests exactly:

- `Dashboard tab should default to progress for a fresh portfolio instance`
- `Dashboard tab preference should persist across portfolio instances`

Both use `KowalskiPortfolio.testing(...)` + `defer { KowalskiPortfolio.resetPersistedDashboardTab() }`. The persistence test is simpler than its period counterpart since `setDashboardTab` is synchronous (no `.get()`/async needed).

## Verification

1. Server: `cd server && npx vitest run src/portfolio/tests/dashboards.integration.test.ts` (and full `npm run test`).
2. `just check-spec` from repo root — must pass after `openapi.yaml` is regenerated and committed.
3. Build `KowalskiClient`/`KowalskiFeatures` (Xcode or `swift build`) to confirm the openapi-generator plugin output and both mapper layers compile.
4. `swift test` in `KowalskiFeatures` (or Xcode test navigator) — confirm new + existing `KowalskiPortfolioTests` pass.
5. Run the app to the Portfolio Dashboards screen: confirm tab selector renders above the period picker; selecting Holdings hides the period picker and shows the pie chart without a network refetch; selecting Progress restores prior behavior; relaunch the app and confirm the last-selected tab persisted; toggle money-value privacy masking and confirm the pie chart swaps to the masked placeholder like the line chart does.
6. Per `AGENTS.md`, run `just ready` from the repository root as the final check and do not report the task as complete until it passes — fix and rerun on any failure.
