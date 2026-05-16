# Add Persisted Portfolio Money Visibility Toggle

## Summary

Implement a portfolio-specific privacy toggle that persists on-device and controls whether money values are shown or masked. The toggle lives in the portfolio navigation bar as an eye icon: `eye` when money is visible, `eye.slash` when hidden. When hidden, monetary amounts should render as a stars placeholder, while non-money values such as stock name, symbol, transaction type, dates, and share count remain visible.

This plan is based on the current code structure:

- The portfolio feature entry view is [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift).
- The feature model is [KowalskiPortfolio.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift), which is `@Observable`, `@MainActor`, and already injected through `.kowalskiPortfolio(...)`.
- The transaction detail screen is [KowalskiPortfolioTransactionDetailScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/Screens/KowalskiPortfolioTransactionDetailScreen.swift).
- The portfolio feature already has its own module identifier in [ModuleConfig.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/ModuleConfig.swift), which is the right place to anchor a persistence key.
- The repo already uses persisted app preferences via `@UserDefaultsObject` in [KowalskiAuth.swift](app/KowalskiFeatures/Sources/KowalskiAuth/KowalskiAuth.swift), so this should follow that same “feature-owned persisted preference” pattern rather than introducing a new global settings system.

## Current Behavior And Existing Surfaces

The current portfolio UI exposes money in these places:

- On the main portfolio screen:
  - “Holdings Net Worth” shows `portfolio.netWorth?.value` formatted with `.currency(code: displayedNetWorthCurrency.rawValue)`.
  - “All-Time Profit” shows a signed currency string from `formattedSignedCurrency(...)`.
  - Profit percentage is shown separately via `formattedSignedPercent(...)`.
- On the transaction detail screen:
  - “Purchase Price” shows `"\(entry.purchasePrice.currency.rawValue) \(entry.purchasePrice.value.formatted(.number))"`.

The current portfolio screen already owns:

- the navigation title `"My Portfolio"`
- a toolbar with the plus button for adding entries
- the top-level loading/empty/content branching
- the overview fetch lifecycle via `.task` and `.onChange(of: auth.effectiveCurrency)`

That makes [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift) the right place for the new eye button.

Important scope decision already made:

- Hide all portfolio money values, not just the summary card.
- Default state on first install should be visible.
- This is display-only privacy; editing forms should continue to show/input actual values.

## Implementation Changes

### 1. Add a persisted portfolio privacy preference

Add a persisted boolean preference owned by the portfolio feature.

Recommended shape:

- Store it in `KowalskiPortfolio` so all portfolio views can read one shared observable source.
- Key it from `ModuleConfig.identifier`, similar to how auth keys its cached session.
- Default it to `true` meaning “show money values”.

Recommended API surface:

- `private static` persisted storage for the raw preference
- `private(set) var showsMoneyValues: Bool`
- `func toggleMoneyVisibility()`
- optionally a small private sync helper if the persisted wrapper needs one

Why this shape fits the existing code:

- `KowalskiPortfolio` is already the long-lived feature object injected into the environment from [KowalskiScene.swift](app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift).
- Portfolio screens already depend on `@Environment(KowalskiPortfolio.self)`.
- This avoids duplicating `@AppStorage` state separately in multiple views.

If `@UserDefaultsObject` is not a good fit for `Bool`, use the nearest existing repo-backed persistence mechanism for primitives, but keep ownership in the portfolio feature and keep the key under the portfolio module identifier.

### 2. Add consistent masking helpers

Create one shared masking representation for hidden money values instead of scattering literal strings through views.

Recommended behavior:

- Monetary value text becomes a stars placeholder such as `"******"`.
- Keep adjacent non-sensitive labels visible where useful, but do not leak numeric value.
- Do not blur, dim, or partially reveal the amount.

Recommended helper surface:

- a private constant or small helper in the portfolio feature, used by both screens
- optionally one helper for full masked currency display and one for masked generic money display if the two screens need slightly different formatting

Consistency requirement:

- Use the same placeholder everywhere money is hidden.
- Do not leave profit sign, decimals, or magnitude visible.
- Profit percentage should also be hidden because it reveals monetary performance indirectly.

### 3. Update the portfolio main screen toolbar

In [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift):

- Keep the existing add-entry plus button.
- Add a second toolbar item for the privacy toggle.
- Use `Image(systemName: portfolio.showsMoneyValues ? "eye" : "eye.slash")`.
- Add an accessibility label that reflects the action, not just the state. Example intent:
  - if visible: “Hide money values”
  - if hidden: “Show money values”

Placement:

- Keep it in the same toolbar area as the add button unless there is an existing toolbar style preference nearby that suggests a different placement.
- Do not move the add button or change current navigation structure.

### 4. Update main screen rendering rules

In the portfolio summary card:

- When visible:
  - keep the existing formatted net worth behavior
  - keep the existing profit currency formatting
  - keep the existing currency label
  - keep the existing profit color logic
- When hidden:
  - replace the net worth amount text with the stars placeholder
  - replace the all-time profit amount text with the stars placeholder
  - replace the profit percentage with a stars placeholder or hide the percentage line entirely

Recommended choice:

- Keep the line structure stable and show a placeholder for both value and percentage, so the card does not jump noticeably.
- Keep the currency label visible because currency code alone is not a money amount.

Specific fields that should remain visible:

- “Holdings Net Worth”
- “All-Time Profit”
- currency label text
- list of entries
- stock symbols and names
- transaction type labels
- share count text such as `10 shares`
- dates

Do not change:

- loading state
- empty state
- overview refresh behavior
- toast behavior

### 5. Update transaction detail rendering rules

In [KowalskiPortfolioTransactionDetailScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/Screens/KowalskiPortfolioTransactionDetailScreen.swift):

- Keep all current sections and rows.
- Only change the displayed value for “Purchase Price”.
- When visible, preserve current formatting.
- When hidden, replace just the numeric money value with the stars placeholder.

Recommended display:

- Either mask the whole field as stars, or keep the currency code and mask the numeric portion.
- Prefer masking the whole field value for simplicity and zero leakage.

Rationale:

- The user explicitly said only money values should be hidden; all other transaction details can stay visible.

### 6. Do not change editor behavior

Do not apply masking to [KowalskiPortfolioTransactionEditor.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/SupportingViews/KowalskiPortfolioTransactionEditor.swift).

- Users must still be able to enter and edit purchase prices normally.
- The privacy feature is for passive viewing when the app is open in public, not for obscuring form input during deliberate editing.

### 7. Preview and test support

Update any previews that rely on portfolio UI if needed so both states can be exercised, ideally without changing unrelated preview data.

If the feature model gets a test-only initializer or setter for the visibility preference, keep it clearly scoped for tests/previews and do not create production-only seams that bypass the real persistence logic unless needed.

## Interface / Type Changes

Likely additions:

- `KowalskiPortfolio`
  - `private(set) var showsMoneyValues: Bool`
  - `func toggleMoneyVisibility()`
- portfolio feature internal persistence key derived from `ModuleConfig.identifier`
- one or more small internal formatting/masking helpers

No server/API/OpenAPI changes are needed.
No auth/session changes are needed.
No changes are needed in `KowalskiClient`.

## Testing And Validation

Add tests at the layers that match the current repo structure.

### Feature tests

Extend [KowalskiPortfolioTests.swift](app/KowalskiFeatures/Tests/KowalskiPortfolioTests/KowalskiPortfolioTests.swift) for the new observable state:

- default visibility is `true` for a fresh portfolio feature instance
- toggling visibility flips the in-memory observable state
- if the persistence wrapper is testable, a new instance picks up the stored value

These tests should stay narrow and not mix with the existing net worth/profit calculation tests except where needed.

### UI tests

Extend [KowalskiPortfolioUITests.swift](app/KowalskiUITests/KowalskiPortfolioUITests.swift) because that file already exercises:

- portfolio screen launch
- navigation into transaction detail
- detail editing
- paired transaction flows

Add scenarios that verify:

- the eye button exists on the portfolio screen
- first launch defaults to visible
- toggling hides the main screen’s net worth/profit values
- share count remains visible after toggling
- toggling then opening a transaction detail screen hides purchase price there too
- relaunching the app preserves the hidden state

Implementation note for UI tests:

- current tests launch with `-ApplePersistenceIgnoreState YES`, which affects window/restoration state, not necessarily app defaults; still verify persistence explicitly across relaunch in the test flow.
- if shared defaults between tests become flaky, isolate or reset the preference in the UI test environment setup.

### Validation commands

For implementation work, the expected verification flow is:

1. `swift build` in the affected package directory if helpful while iterating
2. `just test`
3. `just ready`

Per repo instructions, do not claim completion unless `just ready` passes.

## Assumptions And Defaults

- The eye toggle applies to the whole portfolio feature, not just the summary card.
- Fresh installs default to showing money values.
- The toggle persists locally on the device/app, not via the server.
- “Hide behind stars” means a full placeholder, not partial masking.
- Money values include net worth, profit amount, profit percentage, and transaction purchase price.
- Share counts are intentionally left visible.
- Editing fields remain unmasked.
