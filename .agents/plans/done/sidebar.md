# Portfolio Sidebar Navigation

## Summary

Implement sidebar navigation for the portfolio feature so `Portfolio` is the default first item and `Transactions` is the second item. The current portfolio home screen remains the Portfolio destination. The Net Worth card becomes display-only and no longer navigates to transactions.

## Implementation Changes

- Update [KowalskiScene.swift](app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift:21) to remove the outer `NavigationStack` around `KowalskiPortfolioScreen()`.
- Make `KowalskiPortfolioScreen` own the navigation shell because `KowalskiPortfolioTransactionsScreen` is internal to the `KowalskiPortfolio` package.
- In [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift:14), add a private enum:
  ```swift
  private enum KowalskiPortfolioNavigationItem: Hashable {
      case portfolio
      case transactions
  }
  ```
- Add `@State private var selectedNavigationItem: KowalskiPortfolioNavigationItem? = .portfolio`.
- Replace the current top-level `KJustStack` body with a `NavigationSplitView`:

  ```swift
  NavigationSplitView {
      List(selection: $selectedNavigationItem) {
          NavigationLink(value: KowalskiPortfolioNavigationItem.portfolio) {
              Label("Portfolio", systemImage: "chart.pie")
          }

          NavigationLink(value: KowalskiPortfolioNavigationItem.transactions) {
              Label("Transactions", systemImage: "list.bullet.rectangle")
          }
      }
      .navigationTitle("Net Worth")
  } detail: {
      switch selectedNavigationItem ?? .portfolio {
      case .portfolio:
          NavigationStack { portfolioContent }
      case .transactions:
          NavigationStack { transactionsContent }
      }
  }
  ```

- Keep bootstrap/loading/currency refresh/toast handling on `KowalskiPortfolioScreen`, not inside the individual destinations, so both sidebar sections share the same portfolio model state.
- Extract the current body rendering into private computed views:
  - `portfolioContent`: current loading/empty/content switch, title `My Portfolio`, shared toolbar, frame, and toast.
  - `transactionsContent`: `KowalskiPortfolioTransactionsScreen()`, shared toolbar, frame, and toast.
- Keep the shared toolbar available in both sidebar destinations:
  - Eye button still calls `portfolio.toggleMoneyVisibility()`.
  - Add button still navigates to `KowalskiPortfolioTransactionScreen`.
  - Add success sets the existing `toast = .success(message: "\(payload.stock.name) entry added")`.
- Ensure each destination has its own `NavigationStack` so:
  - Add Transaction pushes and dismisses correctly in the selected section.
  - Transaction detail pushes from `KowalskiPortfolioTransactionsScreen`.
  - Paired transaction actions from `KowalskiPortfolioTransactionDetailScreen` keep their current nested navigation behavior.

## Net Worth Card Changes

- Replace the `NavigationLink` wrapping `netWorthCard` with a plain card view.
- Preserve the current visual layout, spacing, material background, privacy masking, currency display, and all-time profit rendering.
- Remove `.buttonStyle(.plain)` and the `"View transactions"` accessibility label from the card.
- Add a non-action accessibility label such as `"Holdings Net Worth"` or rely on contained text; do not expose it as a button.
- Keep the card padding and `contentShape` only if still useful for accessibility grouping, not for navigation.

## UI Test Updates

- Update [KowalskiPortfolioUITests.swift](app/KowalskiUITests/KowalskiPortfolioUITests.swift:35) helpers:
  - `assertPortfolioSummaryShown` should assert `"Add entry"` and portfolio content such as `"Holdings Net Worth"` or a holding identifier, not `"View transactions"`.
  - `openTransactionsList` should click the sidebar item labeled `"Transactions"` instead of the Net Worth card.
  - `returnToPortfolioSummary` should select the `"Portfolio"` sidebar item instead of relying on back navigation to reveal `"View transactions"`.
- Add a focused regression assertion that the Net Worth card is not exposed as `app.buttons["View transactions"]`.
- Keep existing transaction-detail, paired-action, edit, money-visibility, and creation flow coverage; adjust only navigation helpers unless assertions explicitly depended on the old Net Worth button.
- For create-flow expectations:
  - If Add is launched while `Transactions` is selected, successful dismiss should return to the transactions list.
  - If Add is launched while `Portfolio` is selected, successful dismiss should return to the portfolio screen.

## Files To Touch

- [KowalskiScene.swift](app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift:21)
- [KowalskiPortfolioScreen.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift:14)
- [KowalskiPortfolioUITests.swift](app/KowalskiUITests/KowalskiPortfolioUITests.swift:35)

## Verification

- Run `swift build` from `app/KowalskiFeatures` after changing the portfolio feature package.
- Run `swift build` from `app/KowalskiApp` after removing the app-level `NavigationStack`.
- Run `just test` from the repository root for behavior coverage.
- Run `just ready` from the repository root last.

## Assumptions

- Use SwiftUI `NavigationSplitView` as the sidebar implementation.
- Keep `KowalskiPortfolioTransactionsScreen` internal; do not add a new public API just for app-shell routing.
- Do not manually edit `.xcstrings`; any new visible strings should be introduced in Swift and localization catalogs should remain Xcode-managed.
