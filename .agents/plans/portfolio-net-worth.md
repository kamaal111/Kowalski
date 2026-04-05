# Plan: Portfolio Net Worth on Home Screen

## Problem

The home screen (`KowalskiPortfolioScreen`) only shows a transaction list titled "Transactions". The user wants:

- Title changed to "My Portfolio"
- A "Net Worth" section above the transactions showing the sum of all entries (purchases positive, sells negative) converted to the user's preferred currency via ForexKit.

## Approach

Keep the conversion/fetch logic in `KowalskiPortfolio` (observable) so it stays testable and separate from the view. The screen reads both `KowalskiPortfolio` and `KowalskiAuth` from the environment — auth already exists in the environment tree from `KowalskiScene`.

Net worth formula per entry:

- `purchase` → `+amount × purchasePrice.value`
- `sell` → `-amount × purchasePrice.value`
- `split` → excluded (no monetary value)

All individual totals are converted to `auth.effectiveCurrency` using ForexKit exchange rates.

## Todos

1. Add `ForexKit` as an explicit dependency of the `KowalskiPortfolio` target in `Package.swift`
2. Add net worth state and fetch logic to `KowalskiPortfolio`:
   - `private(set) var netWorth: Double?`
   - `private(set) var isLoadingNetWorth = false`
   - `ForexKit` instance (preview mode for preview/testing factories, live for default)
   - `fetchNetWorth(preferredCurrency: Currencies) async` — fetches rates, computes total, updates `netWorth`
   - Internal pure helper `computeNetWorth(for:in:using:)` for testability
   - Update all factory methods to supply a `ForexKit` instance
3. Update `KowalskiPortfolioScreen`:
   - Add `@Environment(KowalskiAuth.self) private var auth`
   - Change `.navigationTitle("Transactions")` → `.navigationTitle("My Portfolio")`
   - Add net worth card section above the list (shows formatted amount in preferred currency, or a loading indicator while fetching)
   - Trigger `portfolio.fetchNetWorth(preferredCurrency: auth.effectiveCurrency)` after entries load
   - Re-trigger on `.onChange(of: auth.effectiveCurrency)`
4. Add tests in `KowalskiPortfolioTests`:
   - Net worth sums purchases and subtracts sells (all-USD, no conversion needed)
   - Net worth excludes split transactions
   - Net worth with mixed currencies uses ForexKit preview rates to convert to the target currency

## Files Changed

- `app/KowalskiFeatures/Package.swift`
- `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`
- `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolioScreen.swift`
- `app/KowalskiFeatures/Tests/KowalskiPortfolioTests/KowalskiPortfolioTests.swift`
