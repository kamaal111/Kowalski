# Plan: Holdings Net Worth + All-Time Profit Display

## Problem
The net worth card on the portfolio screen needs two changes:
1. Rename "Net Worth" → "Holdings Net Worth"
2. Show all-time profit (monetary + percentage, colour-coded) to the right of the section

## Proposed Approach
Compute all-time profit in `KowalskiPortfolio` alongside the existing net worth computation, then update the card UI in `KowalskiPortfolioScreen`.

---

## Profit Calculation

**Cost Basis**
- For each `purchase` entry: `amount × (preferredCurrencyPurchasePrice?.value ?? purchasePrice.value)`
- For each `sell` entry: subtract `amount × (preferredCurrencyPurchasePrice?.value ?? purchasePrice.value)` from cost basis (recouped investment)
- `split` entries are excluded — they don't represent new capital invested

**Profit**
```
profit = netWorth - netCostBasis
profitPercentage = (profit / netCostBasis) × 100   // nil when netCostBasis == 0
```

**Colour**
| Condition | Colour |
|---|---|
| profit > 0 | `.green` |
| profit < 0 | `.red` |
| profit == 0 | `.secondary` |

---

## Files to Change

### `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`
- Add stored properties: `allTimeProfit: Money?`, `allTimeProfitPercentage: Double?`
- Add private setters `setAllTimeProfit(_:)` and `setAllTimeProfitPercentage(_:)`
- Add private method `computeAllTimeProfit(for:currentValues:) -> (profit: Money, percentage: Double?)?`
- Call it in `fetchOverview()` and persist results

### `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/Screens/KowalskiPortfolioScreen.swift`
- Change `Text("Net Worth")` → `Text("Holdings Net Worth")`
- Refactor `netWorthCard` body:  
  - Wrap in `HStack(alignment: .top)` — left side keeps existing content, right side shows profit
- Add `profitView` computed var:
  - Shows monetary amount with sign prefix (e.g. `+$1,234.56`)
  - Shows percentage next to it (e.g. `(+12.3%)`)
  - Applies `.green` / `.red` / `.secondary` foreground colour

---

## Tests to Add

All tests go in `KowalskiPortfolioTests.swift`, following the same `@Suite` / `@Test` + backtick naming style and the same `MockPortfolioClient` + `#expect` patterns already used there.

Tests are exercised through `fetchOverview()` so profit is derived from the same path the real app uses.

| Test name | What it proves |
|---|---|
| `Overview fetch should compute a profit when current value exceeds purchase cost` | buy 10 @ $100, current price $150 → `allTimeProfit == 500`, `allTimeProfitPercentage == 50` |
| `Overview fetch should compute a loss when current value is below purchase cost` | buy 5 @ $200, current price $100 → `allTimeProfit == -500`, `allTimeProfitPercentage == -50` |
| `Overview fetch should report zero profit when current value equals purchase cost` | buy 4 @ $100, current price $100 → `allTimeProfit == 0`, `allTimeProfitPercentage == 0` |
| `Overview fetch should reduce cost basis by sell proceeds when computing profit` | buy 10 @ $100, sell 2 @ $100 → net cost = $800; current price $150, 8 held → net worth $1200, profit $400, percentage 50 |
| `Overview fetch should exclude split entries from cost basis when computing profit` | buy 2 @ $100, split +3 @ $0, current price $10 → cost basis only from buy ($200), net worth = 5 × $10 = $50, profit = -$150 |
| `Overview fetch should use preferred currency purchase price for cost basis when available` | buy 1 with `purchasePrice: USD 100` and `preferredCurrencyPurchasePrice: EUR 90`, current value EUR 120 → profit is EUR 30, not USD-based |
| `Overview fetch should clear all time profit when net worth is unavailable` | missing current value for a held symbol → `netWorth == nil`, `allTimeProfit == nil`, `allTimeProfitPercentage == nil` |
| `Overview fetch should report nil profit percentage when cost basis is zero` | zero cost basis (all entries sold, no new buys) → `allTimeProfitPercentage == nil` |

---

## Notes / Trade-offs
- If `preferredCurrencyPurchasePrice` is absent for some entries, `purchasePrice` is used as a fallback; a currency mismatch is possible but handled by the existing warning pattern.
- `split` transactions are intentionally excluded from cost basis — splits don't represent invested capital.
- Percentage is nil when cost basis is zero to avoid divide-by-zero.
