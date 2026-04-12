# Stock Split Feature — Implementation Plan

## Problem

Add complete stock split support to the portfolio. Users need to:

1. Create split transactions via a "Split" paired action on Buy transaction detail screens (and via the generic form)
2. See a ratio-based UI (`1/<input>`) when the transaction type is Split, with the price field clarified as "Price before split"
3. Never receive `split` as a transaction type in list/overview API responses — splits are resolved dynamically into buy/sell pairs on the server

## Business Logic

For a 1:10 split on 5 shares at price $150:

- **Sell** all 5 shares at $150 (the given pre-split price)
- **Buy** 50 shares (5 × 10) at $15 ($150 ÷ 10)

These synthetic entries are NOT stored in the database. The DB stores the raw split entry. Resolution happens dynamically on every list/overview read.

## Approach

Server-first: implement split resolution, update response schemas, then update the app UI and regenerate the client.

---

## Phase 1 — Server Changes

### 1. Add resolved transaction type constant

**File:** `server/src/constants/common.ts`

- Add `RESOLVED_TRANSACTION_TYPE_ARRAY = ['buy', 'sell'] as const`
- The existing `TRANSACTION_TYPE_ARRAY` (buy|sell|split) stays for request payloads and DB storage

### 2. Create split resolution service

**New file:** `server/src/portfolio/services/resolve-splits.ts`

- Accept raw persisted entries (all types including splits)
- Sort chronologically (ascending date)
- Walk entries, tracking running holdings per stock (`tickerId`)
  - `buy` → add to holdings
  - `sell` → subtract from holdings
  - `split` → resolve:
    - sharesHeld = current holdings for that stock
    - If sharesHeld > 0: generate a sell (sharesHeld at split price) and a buy (sharesHeld × ratio at price ÷ ratio)
    - If sharesHeld ≤ 0: omit the split (no synthetic entries)
    - Update holdings to sharesHeld × ratio
- Use deterministic UUIDs for synthetic entries (SHA-256 hash of `splitId:sell` / `splitId:buy` formatted as UUID)
- Synthetic entries copy the split entry's date, currency, ticker, audit fields
- Return all entries re-sorted descending by date (matching the current list order)

### 3. Update list-entries service

**File:** `server/src/portfolio/services/list-entries.ts`

- After fetching entries via `findPortfolioEntriesByUserId`, apply `resolveSplits()` before returning

### 4. Update overview service

**File:** `server/src/portfolio/services/overview.ts`

- After fetching entries, apply `resolveSplits()` BEFORE passing to `addPreferredCurrencyPurchasePrices` and `getCurrentStockValues`
- This ensures currency conversion and current-value lookup both operate on the resolved entries

### 5. Create resolved entry response schema

**File:** `server/src/portfolio/schemas/responses.ts`

- Create `ResolvedEntryResponseSchema` that extends `CreateEntryResponseSchema` with `transaction_type` overridden to `z.enum(RESOLVED_TRANSACTION_TYPE_ARRAY)`
- Update `ListEntriesResponseSchema` to use `z.array(ResolvedEntryResponseSchema)`
- Update `PortfolioOverviewResponseSchema.transactions` to use the resolved list schema
- Keep `CreateEntryResponseSchema` unchanged (create/update endpoints still return buy|sell|split)

### 6. Update entry-response mapper

**File:** `server/src/portfolio/mappers/entry-response.ts`

- Add `mapResolvedPortfolioEntryToResponse()` for the resolved entries (same fields, restricted transaction type)
- Update list-entries and overview handlers to use the resolved mapper

### 7. Add integration tests for split resolution

- Split with existing holdings → resolves to sell + buy pair with correct amounts/prices
- Split with zero holdings → omitted from output
- Multiple splits for same stock → each resolves using post-previous-split holdings
- List endpoint returns resolved entries (no split type in response)
- Overview endpoint computes correct net worth/profit through splits

---

## Phase 2 — App UI Changes

### 8. Update TransactionType paired actions

**File:** `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Enums/TransactionType.swift`

- Replace singular `pairedTransactionType: TransactionType?` and `pairedActionTitle: String?` with array-based properties
- `.purchase` → paired actions: `[(.split, "Split"), (.sell, "Sell")]` (Split first, Sell second)
- `.sell` → paired actions: `[(.purchase, "Buy")]`
- `.split` → paired actions: `[]`

### 9. Update detail screen toolbar

**File:** `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/Screens/KowalskiPortfolioTransactionDetailScreen.swift`

- Replace `@State private var pairedTransactionScreenIsShown = false` with `@State private var selectedPairedTransactionType: TransactionType?`
- Replace single paired action button with `ForEach` over the entry's paired actions
- Use `.navigationDestination(item: $selectedPairedTransactionType)` for navigation
- Maintain dismiss-after-paired-transaction behavior

### 10. Update transaction screen title

**File:** `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/Screens/KowalskiPortfolioTransactionScreen.swift`

- Add `.split` case to `screenTitle`: `"Split Transaction"`

### 11. Update transaction editor form for split mode

**File:** `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/SupportingViews/KowalskiPortfolioTransactionEditor.swift`

- When `transactionType == .split`:
  - Amount field: change label from "Amount" to "Ratio", add a "1/" prefix text before the input
  - Purchase price field: change label from "Purchase price" to "Price before split"
- These changes apply regardless of how the split was initiated (paired action or manual picker selection)

### 12. Update form values for split paired action

**File:** same as above (`KowalskiPortfolioTransactionFormValues.pairedCreate`)

- When `transactionType == .split`:
  - Pre-fill stock (same as the buy entry)
  - Pre-fill currency (same as the buy entry)
  - Leave amount (ratio) empty — user must provide the denominator
  - Leave price at default (0)

---

## Phase 3 — OpenAPI Spec & Client Update

### 13. Download updated spec & rebuild client

- Run `just download-spec`
- Build affected Swift packages (`swift build` in `app/KowalskiClient`)
- The generated client will have a new `ResolvedEntryResponse` schema with `transaction_type: buy|sell`
- Update `KowalskiPortfolioMapper` and `KowalskiPortfolioClient` to handle the resolved response type for list/overview
- Create/update endpoints continue using `CreateEntryResponse` (unchanged)

### 14. Clean up app-side split handling in overview computations

**File:** `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`

- `computeNetWorth` and `computeAllTimeProfit` currently have a `.split` case that adds to holdings / skips cost basis
- Since overview responses will no longer contain splits, these cases become unreachable
- Remove or simplify the `.split` handling

---

## Design Decisions

| Decision                   | Choice                                                                                                                        | Rationale                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Response schema split      | `ResolvedEntryResponseSchema` (buy\|sell) for list/overview; `CreateEntryResponseSchema` (buy\|sell\|split) for create/update | Create/update return what was stored; list/overview return the resolved view |
| Synthetic entry IDs        | Deterministic UUID from SHA-256 of `{splitId}:{sell\|buy}`                                                                    | Consistent across requests; no ID collisions with real entries               |
| Empty-holdings split       | Silently omitted                                                                                                              | No shares to split → no meaningful synthetic entries                         |
| Resolution layer           | Service layer (between repo and handler)                                                                                      | Keeps DB queries untouched; resolution is a pure transformation              |
| Button order on Buy detail | \[Split\] \[Sell\] \[Edit\]                                                                                                   | Split left of Sell per the user's request                                    |

## Considerations

- **Editability gap**: Synthetic entries from split resolution have no DB counterpart as buy/sell. Users cannot directly edit them. To modify a recorded split, a future enhancement could surface the original split entry for editing.
- **Preferred currency conversion**: Runs after split resolution, so synthetic entries get the same currency treatment as regular entries.
- **Bulk import**: Imported splits are stored as-is and resolved on subsequent reads.
