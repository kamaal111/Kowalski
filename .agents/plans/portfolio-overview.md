# Plan: Portfolio Overview Endpoint with Current Stock Values

## Problem

The app currently calls `GET /app-api/portfolio/entries` to fetch portfolio transactions, then would need a separate call to get current stock prices — potentially passing many ticker IDs as query params (not scalable). We need a single endpoint that returns both transactions and current stock values, keyed by stock symbol.

## Approach

Create a new `GET /app-api/portfolio/overview` endpoint that:

1. Returns transactions (same shape as current `GET /entries`)
2. Fetches current stock prices from Yahoo Finance (batched `quote()` call)
3. Caches prices in the existing `stock_info` DB table — **one fetch per ticker per day**
4. Converts prices to the user's preferred currency using stored exchange rates
5. Falls back gracefully: today's DB → Yahoo Finance → latest DB row → fail

### Response Shape

```json
{
  "transactions": [
    {
      "id": "...",
      "stock": { "symbol": "AAPL", "exchange": "NMS", ... },
      "amount": 10,
      "purchase_price": { "currency": "USD", "value": 150.5 },
      "preferred_currency_purchase_price": { "currency": "EUR", "value": 138.07 },
      "transaction_type": "buy",
      "transaction_date": "2025-12-20T00:00:00.000Z",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "current_values": {
    "AAPL": { "currency": "EUR", "value": 185.45 },
    "MSFT": { "currency": "EUR", "value": 420.50 }
  }
}
```

- `transactions`: identical to the current `GET /entries` response array
- `current_values`: map of stock symbol → `{ currency, value }` in preferred currency (or native currency if no preference)
- Key is the stock's Yahoo Finance symbol (e.g. `"AAPL"`, `"BMW.DE"`) since it's already in `transaction.stock.symbol`

### Fallback Chain (per ticker)

1. Check `stock_info` table for today's date → use if found (avoids Yahoo call entirely)
2. Fetch from Yahoo Finance → store result in `stock_info`
3. If Yahoo fails, check `stock_info` for any previous date → use the latest
4. If no data exists at all → fail the entire request with 500

## Schema Change

The existing `stock_info` table (currently unused — "schema groundwork") has a `timestamp` column. Since we're doing once-per-day caching, change it to `date` for cleaner semantics:

**Before:**

```typescript
timestamp: timestamp('timestamp').notNull(),
// unique on (tickerId, timestamp)
```

**After:**

```typescript
date: date('date').notNull(),
// unique on (tickerId, date)
```

This prevents accidental intra-day duplicates and makes queries straightforward. Safe because the table is empty/unused.

## Todos

### 1. `schema-change` — Modify `stock_info` table schema

- File: `server/src/db/schema/stocks.ts`
- Change `timestamp` column to `date` type
- Update unique constraint references
- The `id` format becomes `"${tickerId}:${date}"` (e.g. `"portfolio-stock:NMS:AAPL:2026-04-06"`)

### 2. `migration` — Generate and run database migration

- Run `just make-migrations` to generate ALTER TABLE migration
- Run `just migrate` to apply
- Depends on: `schema-change`

### 3. `response-schema` — Add overview response schema

- File: `server/src/portfolio/schemas/responses.ts`
- Add `CurrentValueSchema` (Money object)
- Add `PortfolioOverviewResponseSchema` with `transactions` + `current_values` fields
- Export types

### 4. `exception` — Add stock price fetch exception

- File: `server/src/portfolio/exceptions.ts`
- Add `StockPriceFetchFailed` exception (500) for when no price can be resolved

### 5. `stock-price-repo` — Create stock price repository

- New file: `server/src/portfolio/repositories/stock-prices.ts`
- `findTodayStockPricesByTickerIds(c, tickerIds, today)` — batch query for today's prices
- `findLatestStockPricesByTickerIds(c, tickerIds)` — fallback query for latest available prices (any date)
- `insertStockPrices(c, prices)` — batch insert new price rows
- Depends on: `schema-change`

### 6. `yahoo-quote-service` — Create Yahoo Finance quote service

- New file: `server/src/portfolio/services/yahoo-quote.ts`
- Wraps `yahooFinance.quote([...symbols], { fields: ['symbol', 'regularMarketPrice', 'currency'] })`
- Returns a map of symbol → `{ currency, price }` or null
- Handles errors gracefully (logs failures, returns partial results)
- Reuses the existing `YahooFinance` import pattern from `stocks/handlers/search.ts`

### 7. `current-values-service` — Create current stock values service

- New file: `server/src/portfolio/services/current-stock-values.ts`
- Main orchestration logic:
  1. Extract unique ticker symbols from entries
  2. Query DB for today's prices (batch)
  3. For missing tickers, call Yahoo Finance
  4. Store fresh Yahoo prices in DB
  5. For tickers Yahoo couldn't fetch, try latest DB row (any date)
  6. If any ticker still has no price, throw `StockPriceFetchFailed`
  7. Convert all prices to preferred currency using exchange rate snapshot
- Depends on: `stock-price-repo`, `yahoo-quote-service`, `exception`

### 8. `overview-service` — Create overview service

- New file: `server/src/portfolio/services/overview.ts`
- Combines:
  - `listPortfolioEntries(c)` (existing)
  - `addPreferredCurrencyPurchasePrices(c, entries)` (existing)
  - `getCurrentStockValues(c, entries)` (new)
- Returns `{ transactions, currentValues }`
- Depends on: `current-values-service`

### 9. `overview-route` — Create route definition

- New file: `server/src/portfolio/routes/overview.ts`
- `GET /overview` with auth middleware
- References `PortfolioOverviewResponseSchema`
- Error responses: 401, 404, 500
- Depends on: `response-schema`

### 10. `overview-handler` — Create handler

- New file: `server/src/portfolio/handlers/overview.ts`
- Calls `overview-service`, maps results, logs success
- Follows existing handler pattern from `list-entries.ts`
- Depends on: `overview-service`, `overview-route`

### 11. `register-route` — Register in portfolio router

- File: `server/src/portfolio/routes/index.ts`
- Add `.openapi(overviewRoute, overview)` to the chain
- Depends on: `overview-route`, `overview-handler`

### 12. `test-helpers` — Add test seeding helpers

- File: `server/src/portfolio/tests/helpers.ts`
- Add `seedStockInfo(db, { tickerId, currency, date, price })` helper

### 13. `integration-tests` — Write integration tests

- New file: `server/src/portfolio/tests/overview.integration.test.ts`
- Test cases:
  - Returns transactions + current_values for seeded data (prices pre-seeded in DB for today)
  - Returns empty when user has no entries
  - Uses cached DB prices (no Yahoo call) when today's prices exist
  - Converts current values to preferred currency
  - Returns native currency when no preferred currency is set
  - Falls back to previous day's price when today's is missing
  - Rejects unauthenticated requests
  - Logs structured events
- Note: Yahoo Finance calls should be mocked in tests to avoid network dependency
- Depends on: `register-route`, `test-helpers`

## Design Decisions

- **Endpoint path**: `GET /app-api/portfolio/overview` — descriptive and sits alongside `/entries`
- **Response keys**: `transactions` (camelCase alternatives considered but snake_case matches existing `purchase_price`, `transaction_type`)
- **current_values key**: Stock symbol (e.g., `"AAPL"`) — already in each transaction's `stock.symbol` for easy client-side lookup
- **No `data` wrapper**: Matches existing API convention (flat objects/arrays)
- **Old endpoint stays**: `GET /entries` remains available; client migration happens separately
- **Date column**: Changed from `timestamp` to `date` for once-per-day semantics
- **Yahoo Finance batching**: Single `quote([...symbols])` call for all unique symbols in one request
