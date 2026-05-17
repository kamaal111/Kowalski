# Portfolio Holdings Summary And Transactions Navigation

**Current Context**

- The portfolio API is layered as route, handler, service, repository under `server/src/portfolio/**`.
- Existing routes are registered in `server/src/portfolio/routes/index.ts`: `/entries`, `/overview`, `/entries/bulk`, and entry update/create.
- `GET /overview` currently returns `{ transactions, current_values }` via `server/src/portfolio/services/overview.ts`.
- `overview` already resolves split transactions with `resolveSplits(...)`, enriches transactions with preferred-currency purchase prices, and gets current prices through `getCurrentStockValues(...)`.
- Current-price logic already handles cached daily prices, Yahoo fallback, latest stored prices, preferred-currency conversion, and failure when required FX/price data is missing.
- The Swift portfolio screen currently computes holdings/net worth locally in `KowalskiPortfolio.swift` from overview transactions and `currentValues`.
- `KowalskiPortfolioScreen.swift` currently renders `netWorthCard` followed by `entriesList`, where `entriesList` is the transaction list.
- Transaction detail navigation currently happens directly from portfolio rows to `KowalskiPortfolioTransactionDetailScreen`.
- Existing UI tests in `app/KowalskiUITests/KowalskiPortfolioUITests.swift` assume transaction rows are visible on the first portfolio screen.

**Backend Contract**

- Add a new endpoint: `GET /app/api/portfolio/holdings`.
- Do not use `stocks` in endpoint, response, client, or feature model names except for existing ticker/stock metadata fields.
- Add neutral schemas in `server/src/portfolio/schemas/responses.ts`:
  - `PortfolioHoldingAssetSchema`: current stock/ticker metadata shape reused from existing entry payload stock shape.
  - `PortfolioHoldingSchema`: `{ asset_type, asset, amount, unit_value, total_value }`.
  - `PortfolioHoldingsResponseSchema`: `{ net_worth, holdings }`.
- Use `asset_type: "equity"` for now. This keeps the endpoint future-proof while accurately describing current assets.
- `unit_value` is the current per-share value in the user’s preferred currency when configured, otherwise quote currency.
- `total_value` is `amount * unit_value.value` with the same currency as `unit_value`.
- `net_worth` is the sum of `total_value.value` across holdings.
- Empty portfolios return `{ net_worth: { currency: preferredCurrency ?? "USD", value: 0 }, holdings: [] }`.
- If a non-empty portfolio cannot resolve a required price or FX rate, preserve the existing clear failure behavior and return server error rather than a misleading partial success.

**Backend Implementation**

- Add files following existing portfolio patterns:
  - `server/src/portfolio/routes/holdings.ts`
  - `server/src/portfolio/handlers/holdings.ts`
  - `server/src/portfolio/services/holdings.ts`
- Register the route in `server/src/portfolio/routes/index.ts` after `/overview` or near other reads.
- Implement the service by reusing existing helpers:
  - Fetch owned entries with `findPortfolioEntriesByUserId(c)`.
  - Resolve splits with `resolveSplits(entries)`.
  - Get current values with `getCurrentStockValues(c, resolvedEntries)`.
  - Aggregate by ticker identity or symbol/exchange, using the existing resolved entries’ stock metadata.
- Aggregation rules:
  - `buy` adds amount.
  - `sell` subtracts amount.
  - Raw `split` should not appear after `resolveSplits`; if it does, do not treat it as a holding delta.
  - Omit holdings where final amount is `0`.
  - Keep only holdings with positive or negative non-zero amount; do not silently clamp negative holdings because sells can expose data issues worth seeing.
  - Sort holdings by `total_value.value` descending, then symbol ascending for stable output.
- Handler should validate output through `PortfolioHoldingsResponseSchema.parse(...)`.
- Handler logging should mirror overview style with event such as `portfolio.holdings.retrieved`, `result_count`, and `net_worth_currency`.

**Backend Tests**

- Add `server/src/portfolio/tests/holdings.integration.test.ts`.
- Reuse helpers from `server/src/portfolio/tests/helpers.ts`: `seedPortfolioEntry`, `seedStockInfo`, `seedExchangeRate`.
- Cover:
  - Multiple transactions for the same symbol aggregate into one holding.
  - Sells reduce the held amount and total value.
  - Split entries are resolved before aggregation.
  - Empty portfolio returns zero net worth and empty holdings.
  - Preferred currency converts `unit_value`, `total_value`, and `net_worth`.
  - Missing FX/price data returns the same explicit internal-error behavior as overview.
  - Cross-user isolation: another user’s entries do not appear in holdings.
- Keep existing `/overview` tests unchanged unless the implementation extracts shared helper code and requires import updates.

**OpenAPI And Swift Client**

- After backend route/schema changes, run `just download-spec` so `app/KowalskiClient/Sources/KowalskiClient/openapi.yaml` is updated from the server app.
- Add client response models under `app/KowalskiClient/Sources/KowalskiClient/Responses/`, using names like:
  - `KowalskiPortfolioHoldingsResponse`
  - `KowalskiPortfolioHoldingResponse`
  - `KowalskiPortfolioAssetResponse`
- Extend `KowalskiPortfolioClient` with `getHoldings() async -> Result<KowalskiPortfolioHoldingsResponse, KowalskiPortfolioClientHoldingsErrors>`.
- Implement generated-operation mapping in `KowalskiPortfolioClientImpl`, following `getOverview()`.
- Extend `KowalskiPortfolioMapper` to map the generated holdings response into client response models.
- Update `KowalskiPortfolioClientPreview` so previews and UI tests can return holdings without network calls.

**Swift Feature State**

- Add neutral feature data models under `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Models/DataObjects/`, such as:
  - `PortfolioHolding`
  - `PortfolioAsset`
- Add `private(set) var holdings: [PortfolioHolding] = []` to `KowalskiPortfolio`.
- Keep `entries: [PortfolioEntry]` because transaction list/detail/edit flows still depend on it.
- Replace local holdings/net-worth calculation for the first screen with server-backed `getHoldings()`.
- Keep fetching transactions through existing `/entries` or `/overview` path for the transaction list screen. Prefer `/entries` for the list because the new holdings endpoint owns summary data.
- Refresh both holdings and entries after create, update, import, and paired transaction creation so both screens stay consistent.
- Preserve `showsMoneyValues`, money masking, all-time profit display, and existing failure-to-toast behavior.
- If all-time profit still needs transaction cost basis, compute it from `entries` plus server-backed `netWorth`, or keep it unavailable until entries load. Prefer loading entries together with holdings on portfolio load to avoid a visible regression.

**Swift UI**

- Change `KowalskiPortfolioScreen` from “net worth + transactions” to “net worth + holdings”.
- Make the Net Worth card a `NavigationLink` or tappable card that navigates to a new transactions list screen.
- New screen name can be `KowalskiPortfolioTransactionsScreen`; it should render the existing transaction row list and navigate to `KowalskiPortfolioTransactionDetailScreen`.
- Move the current `entriesList` implementation from `KowalskiPortfolioScreen` into the new transactions screen.
- Portfolio screen holding rows should show:
  - symbol and asset name
  - amount held, formatted as shares for equity assets
  - total value, masked when `showsMoneyValues == false`
  - optional unit value if the row has enough room without clutter
- Empty state should distinguish no holdings from no transactions only if needed; otherwise keep a simple “No portfolio entries yet” message.
- Accessibility:
  - Net Worth card label should communicate navigation, e.g. `View transactions`.
  - Holding rows should use identifiers like `portfolio-holding-Apple Inc.`.
  - Existing transaction row identifiers like `portfolio-entry-Apple Inc.` should remain on the transactions screen so UI tests and detail navigation stay meaningful.

**Swift Tests / UI Tests**

- Update `KowalskiPortfolioUITests.swift` helper flow:
  - `assertTransactionsListShown` should navigate through the Net Worth card before expecting transaction rows, or be split into `assertPortfolioSummaryShown` and `openTransactionsList`.
  - `openTransactionDetail(...)` should open the transactions list first if currently on the summary screen.
  - Existing transaction creation and editing flows should still validate success toast, validation errors, paired split/sell actions, and masked money behavior.
- Update preview scenarios in `KowalskiPortfolio.forEnvironment()` and `KowalskiPortfolioClientPreview` so `.entries` shows holdings on the first screen and transactions after navigation.
- Do not add UI-test-only identifiers unless a user-facing accessibility label cannot cover the interaction.

**Verification**

- Run narrow checks while implementing:
  - `just test-server` after backend tests.
  - `just download-spec` after the API contract is ready.
  - `swift build` from the affected Swift package directory after client/feature updates.
  - `just test` after behavior is wired.
- Run final verification with `just ready`.
- If `just ready` fails, fix and rerun until it passes before claiming completion.

**Assumptions**

- The chosen endpoint name is `/holdings`.
- “Click on Net Worth section” means the Net Worth card on the portfolio summary screen navigates to transactions.
- Existing `/overview` stays for compatibility; new UI should prefer `/holdings` for summary and `/entries` for transactions.
- First implementation supports equity holdings only, but public naming uses asset/holding terminology so future asset types can be added without renaming the endpoint.
