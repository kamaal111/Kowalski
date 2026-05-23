# Add Per-Holding Profit/Loss To Holdings Home Screen

## Summary

Add per-holding profit/loss to the holdings list on the portfolio home screen by deriving it in the Swift feature layer from data the app already fetches today. No server route, schema, OpenAPI, or generated client change is needed.

The implementation should follow the existing portfolio architecture already in use:

- `server /overview` returns resolved transactions, current values, aggregated holdings, and net worth.
- `KowalskiClient` maps that response into `KowalskiPortfolioOverviewResponse`.
- `KowalskiPortfolioMappers` maps that into `PortfolioOverviewState`.
- `KowalskiPortfolio` owns derived state like overall `allTimeProfit`.
- `KowalskiPortfolioScreen` renders the home screen and already contains shared signed currency/percent formatting logic and money-privacy behavior.

The change should extend that same pattern so each `PortfolioHolding` gets a derived `AllTimeProfit?`, then the home screen renders it below the existing unit price line as `amount + percent`.

## Research Findings

### Existing Home Screen Structure

The holdings home screen is implemented in [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift).

Current row layout per holding is:

- first line: symbol + company name
- second line: shares on the left, holding total value on the right
- third line when money is visible: `Unit <price>`

There is already an overall profit UI on the net-worth card:

- `profitView`
- `formattedAllTimeProfit`
- `formattedAllTimeProfitPercentage`
- `formattedSignedCurrency(value:currency:)`
- `formattedSignedPercent(_:)`
- `allTimeProfitColor`

Those helpers should be reused or generalized instead of inventing a second formatting style.

### Existing Derived Profit Logic

`KowalskiPortfolio` already computes overall all-time profit client-side in [KowalskiPortfolio.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift).

Relevant behavior already established there:

- profit is derived from `entries` plus `netWorth`
- `preferredCurrencyPurchasePrice` is preferred over raw `purchasePrice`
- buys increase cost basis
- sells decrease cost basis
- splits do not directly change cost basis
- if currencies become inconsistent with the displayed net worth currency, the method logs a warning and returns `nil`
- if all holdings net to zero, overall `allTimeProfit` is `nil`

This is important because per-holding profit should match the semantics of the existing total-profit calculation instead of introducing a new financial definition.

### Existing Data Available To Compute Per-Holding Profit

The app already has enough data locally:

- `KowalskiPortfolioOverviewResponse` contains:
  - `transactions`
  - `currentValues`
  - `holdings`
  - `netWorth`
- each transaction includes:
  - `amount`
  - `purchasePrice`
  - `preferredCurrencyPurchasePrice`
  - `transactionType`
  - stock symbol metadata
- each holding includes:
  - `asset`
  - `amount`
  - `unitValue`
  - `totalValue`

That means we do not need server support for profit/loss per holding.

### Existing Types

Current holding model in [PortfolioHolding.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/PortfolioHolding.swift) is:

- `assetType`
- `asset`
- `amount`
- `unitValue`
- `totalValue`

There is already an `AllTimeProfit` value object in [AllTimeProfit.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/AllTimeProfit.swift) with:

- `profit: Money`
- `percentage: Double?`
- derived `currency`
- derived `value`

That type is a natural fit for per-holding P/L too.

### Existing Mapping and Refresh Flow

`KowalskiPortfolioMappers.mapOverviewResponse` currently maps server/client data into a `PortfolioOverviewState` with:

- `entries`
- `currentValues`
- `netWorth`
- `holdings`

Then `KowalskiPortfolio.refreshFromServer`:

- fetches overview
- maps overview
- computes overall `allTimeProfit`
- stores `holdings`, `entries`, `netWorth`
- persists the cached snapshot

Cached hydration in `hydrateCachedSnapshotIfAvailable` restores:

- `entries`
- `holdings`
- `netWorth`
- recomputes overall `allTimeProfit`

Per-holding profit should fit into this exact lifecycle so live and cached state behave the same.

### Server Contract Confirmation

The server portfolio overview schema in [responses.ts](server/src/portfolio/schemas/responses.ts) currently defines holding fields only as:

- `asset_type`
- `asset`
- `amount`
- `unit_value`
- `total_value`

The overview service in [overview.ts](server/src/portfolio/services/overview.ts) computes holdings only from aggregated amount and current price. It does not compute cost basis or profit/loss.

Because the user request is a UI enhancement and the app already has the needed transaction history, adding API fields would be extra surface area without functional need.

## Implementation Changes

### 1. Extend The Holding Model

Update [PortfolioHolding.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/PortfolioHolding.swift):

- add `let allTimeProfit: AllTimeProfit?`

Keep the type `Codable, Hashable` if possible. Because `AllTimeProfit` is currently only `Hashable`, it must be made `Codable` too if `PortfolioHolding` is to remain `Codable` and continue working inside cached snapshots.

Update [AllTimeProfit.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/AllTimeProfit.swift):

- add `Codable` conformance
- preserve existing API shape and derived properties

No public API expansion beyond the app module’s internal feature models is required.

### 2. Keep Raw Mapping Simple

Update [KowalskiPortfolioMappers.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Mappers/KowalskiPortfolioMappers.swift):

- when mapping a `KowalskiPortfolioHoldingResponse` into `PortfolioHolding`, initialize `allTimeProfit` as `nil`
- do not move financial derivation into the mapper
- keep `PortfolioOverviewState` shape unchanged unless it becomes clearer to include enriched holdings there after a separate helper step

Recommended approach:

- keep server-to-model mapping purely structural
- do the per-holding P/L derivation in `KowalskiPortfolio`, where overall derived state already lives

### 3. Add Per-Holding Profit Derivation In `KowalskiPortfolio`

Implement a new helper flow in [KowalskiPortfolio.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift) that enriches holdings after overview mapping.

Recommended structure:

- add `computeHoldingProfit(for holding: PortfolioHolding, entries: [PortfolioEntry]) -> AllTimeProfit?`
- add `computeHoldingsWithProfit(holdings: [PortfolioHolding], entries: [PortfolioEntry]) -> [PortfolioHolding]`

Behavior for `computeHoldingProfit`:

1. Filter `entries` to the ones whose `stock.symbol` matches `holding.asset.symbol`.
2. Determine whether the holding is still active.
   - safest and most consistent check: if `holding.amount == 0`, return `nil`
   - do not rely only on entry presence
3. Compute cost basis for that symbol:
   - for each entry, use `entry.preferredCurrencyPurchasePrice ?? entry.purchasePrice`
   - require `costBasisMoney.currency == holding.totalValue.currency`
   - if any mismatch occurs, log a warning and return `nil`
   - `purchase`: `costBasis += entry.amount * price`
   - `sell`: `costBasis -= entry.amount * price`
   - `split`: ignore for cost-basis delta
4. Compute profit amount:
   - `profitValue = holding.totalValue.value - costBasis`
5. Compute percentage:
   - if `costBasis == 0`, `percentage = nil`
   - else `percentage = (profitValue / costBasis) * 100`
6. Return `AllTimeProfit(profit: Money(currency: holding.totalValue.currency, value: profitValue), percentage: percentage)`

Behavior for `computeHoldingsWithProfit`:

- map over holdings in existing order
- for each holding, create a new `PortfolioHolding` with identical fields plus computed `allTimeProfit`

Important consistency note:

- This per-holding definition should intentionally match the current overall `computeAllTimeProfit` semantics, even if the broader accounting treatment of realized gains is simplified. Do not “fix” or redefine overall profit logic in this task.

### 4. Use Enriched Holdings During Refresh And Cache Hydration

Update `refreshFromServer` in [KowalskiPortfolio.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift):

- after `overviewState` is mapped, compute:
  - `let enrichedHoldings = computeHoldingsWithProfit(holdings: overviewState.holdings, entries: overviewState.entries)`
- keep overall profit computation as-is:
  - `let profitResult = computeAllTimeProfit(for: overviewState.entries, netWorth: overviewState.netWorth)`
- store:
  - `setHoldings(enrichedHoldings)`
  - `setEntries(overviewState.entries)`
  - `setNetWorth(overviewState.netWorth)`
  - `setAllTimeProfit(profitResult)`

Update cached hydration:

- after restoring cached `entries`, `holdings`, and `netWorth`, recompute enriched holdings from cached entries rather than trusting older serialized holdings blindly
- recommended order:
  - `let enrichedHoldings = computeHoldingsWithProfit(holdings: cachedSnapshot.holdings, entries: cachedSnapshot.entries)`
  - `setHoldings(enrichedHoldings)`
  - recompute overall `allTimeProfit` the same way it works today

Reason:

- this guarantees old caches without the new field still hydrate cleanly
- it also avoids stale derived values if the caching format predates the feature

### 5. Preserve Cached Snapshot Compatibility

`CachedPortfolioSnapshot` stores `holdings`, `entries`, and `netWorth`. Because `PortfolioHolding` is serialized there, adding a new optional property should be backward compatible as long as decoding missing keys is tolerated by Swift `Codable`.

Still, the implementation should not depend on cached `allTimeProfit` values being present.

Recommended behavior:

- either let the field serialize naturally and recompute after decode
- or recompute and overwrite immediately after hydration, which is preferable for determinism

No migration file is needed.

### 6. Update Home Screen Rendering

Update [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift).

For each holding row:

- keep current first line unchanged
- keep current second line unchanged
- keep current `Unit ...` line unchanged when money values are visible
- add a new line under the unit-value line for holding profit/loss

Requested display choice:

- show both amount and percentage

Recommended rendered text:

- `"P/L \(signed amount) (\(signed percent))"`

Example:

- `P/L +€120.00 (+8.7%)`
- `P/L -$54.50 (-3.2%)`
- `P/L $0.00 (0%)` or equivalent zero formatting using the existing helpers

Recommended styling:

- `.font(.caption)`
- gain: `.green`
- loss: `.red`
- zero or unavailable: `.secondary`

Recommended implementation detail:

- add small private helpers instead of embedding formatting in the view body:
  - `holdingProfitColor(_ holding: PortfolioHolding) -> Color`
  - `formattedHoldingProfit(_ holding: PortfolioHolding) -> String`
  - `formattedHoldingProfitPercentage(_ holding: PortfolioHolding) -> String`
  - or one combined helper if that reads better

Formatting rules should match the existing summary card:

- signed currency via the existing `formattedSignedCurrency`
- signed percent via the existing `formattedSignedPercent`
- if percentage is `nil`, show only amount rather than empty parentheses

Recommended combined line behavior:

- if `allTimeProfit` exists and `percentage` exists: `P/L <amount> (<percent>)`
- if `allTimeProfit` exists and `percentage == nil`: `P/L <amount>`
- if `allTimeProfit == nil`: render nothing for this line

### 7. Respect Money Privacy

The new per-holding P/L line must follow the same money-visibility behavior already used elsewhere.

When `portfolio.showsMoneyValues == false`:

- do not show real P/L amount
- do not show real percent
- render the same mask placeholder used elsewhere: `PortfolioMoneyValuePrivacy.maskedPlaceholder`
- use the same accessibility identifier where appropriate

Recommended UX:

- continue showing the row
- replace the profit line content with a masked placeholder
- keep the line in place so row height does not jump dramatically when toggling visibility

Important detail:

- the current row only shows the `Unit ...` line when money values are visible
- for the new P/L line, either:
  - only show it when money is visible and show nothing otherwise, or
  - show a masked placeholder when hidden
- because privacy consistency matters and the user explicitly wants the feature on the holdings screen, use the second behavior: keep the line present but masked

### 8. Accessibility

Current rows already use:

- `.accessibilityElement(children: .combine)`
- `.accessibilityLabel(Text("\(holding.asset.name), \(holding.amount.formatted(.number)) shares"))`

That label currently omits financial detail entirely.

Recommended update:

- keep the row combined
- expand the accessibility label when money values are visible to include:
  - holding name
  - share count
  - total value
  - profit/loss amount
  - percentage when present

When money values are hidden:

- keep the accessibility output privacy-safe
- do not expose hidden values through accessibility labels
- use the same masking approach as visible text

Suggested accessibility label shape when visible:

- `"<name>, <shares> shares, value <total>, profit <amount>, <percent>"`

Suggested label when hidden:

- keep the current non-financial label or add masked wording, but do not leak money values

The exact phrasing can follow SwiftUI interpolation patterns already used in the file.

## Files To Change

Primary files:

- [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift)
- [KowalskiPortfolio.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift)
- [PortfolioHolding.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/PortfolioHolding.swift)
- [AllTimeProfit.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/AllTimeProfit.swift)
- [KowalskiPortfolioMappers.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Mappers/KowalskiPortfolioMappers.swift)
- [KowalskiPortfolioTests.swift](app/KowalskiFeatures/Tests/KowalskiPortfolioTests/KowalskiPortfolioTests.swift)

Do not change unless implementation reveals a real blocker:

- server portfolio routes/services/schemas
- OpenAPI spec
- generated API client files

## Detailed Test Plan

Add focused Swift feature tests in [KowalskiPortfolioTests.swift](app/KowalskiFeatures/Tests/KowalskiPortfolioTests/KowalskiPortfolioTests.swift), following the existing `@Suite("Portfolio Feature Tests", .serialized)` and helper patterns already present in the file.

### New Behavior Tests

1. `Overview fetch should compute positive profit for a holding`

- seed one buy transaction for AAPL
- current value higher than purchase price
- assert first holding has non-nil `allTimeProfit`
- assert profit amount matches current total minus cost basis
- assert percentage is correct

2. `Overview fetch should compute negative profit for a holding`

- same as above with current value lower than purchase price
- assert negative amount and negative percentage

3. `Overview fetch should compute per-holding profit independently for multiple symbols`

- at least AAPL and MSFT
- give each a different purchase price/current value profile
- assert each holding’s profit is computed from only its own entries

4. `Overview fetch should reduce holding cost basis when sell transactions exist`

- buy then sell same symbol
- assert remaining holding amount and cost basis produce the expected P/L under the current app logic

5. `Overview fetch should ignore split transactions when computing holding profit`

- include split-resolved transaction patterns already used in current tests
- assert split does not create direct cost-basis delta

6. `Overview fetch should return nil holding profit when holding nets to zero`

- transactions net to zero shares
- assert no holding-level profit is exposed for removed holdings
- align with current behavior that zero-net holdings disappear from holdings list

7. `Cached snapshot hydration should recompute holding profit`

- bootstrap once to persist a snapshot
- create a fresh `KowalskiPortfolio` instance
- bootstrap again with same scope so hydration path runs
- assert hydrated holdings have the same computed `allTimeProfit`

8. `Holding profit should be nil when transaction currency does not match displayed holding currency`

- use preferred currency purchase price or mixed setup to force mismatch
- assert method safely returns `nil` rather than displaying wrong numbers

### Existing Test Helpers To Reuse

The file already has helpers for:

- `makePortfolioOverviewResponse`
- `makePortfolioHoldingResponses`
- `makePortfolioEntryResponse`
- mock clients and overview preflight fixtures

Update those helpers only as needed:

- `makePortfolioHoldingResponses` does not need to precompute profit if the app computes it during refresh
- if `PortfolioHolding` gains an extra field, helper-generated holdings can still initialize it as `nil`

### Verification Commands

During implementation:

- run the narrowest useful Swift/app test command first if available
- then run `just test`
- run `just ready` last before declaring completion

If a smaller package build is useful while iterating, `swift build` in the affected package directory is appropriate per repo guidance.

## Assumptions And Defaults Chosen

- Profit/loss is shown on the holdings home screen only, not in transactions list or detail screens.
- Display format is `amount + percent`, because that is what you selected.
- Per-holding percentage is computed from that holding’s own cost basis.
- The app should preserve the existing portfolio-wide profit semantics; this task does not redefine realized/unrealized accounting.
- No backend or API change is required because the app already has enough data.
- The feature must honor the existing money-visibility privacy toggle.
- Cached snapshots should remain backward compatible and derived profit should be recomputed after hydration for safety.

## Implementation Notes For The Next Agent

- Start from app-only changes; do not expand scope into server work unless you uncover a concrete blocker.
- Reuse the existing overall profit formatting helpers in `KowalskiPortfolioScreen` rather than duplicating sign/percent logic.
- Keep derivation in `KowalskiPortfolio`, not in the generated client layer and not in the server mapper.
- Be careful with `Codable` compatibility on `PortfolioHolding` once the new field is added.
- Do not manually edit `.xcstrings`.
- Final verification is not optional for code changes: `just ready` must pass before closing the task.
