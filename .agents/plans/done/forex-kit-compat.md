# ForexKit Compatibility Layer Plan

## Problem

ForexKit is configured with a `forexBaseURL` and internally appends `/latest` to it. It expects:

```
GET {forexBaseURL}/latest?base=EUR&symbols=USD,GBP,...
```

Response:

```json
{ "base": "EUR", "date": "2022-12-30", "rates": { "USD": 1.07, "GBP": 0.88, ... } }
```

The server already collects ECB exchange rates into the `exchange_rates` table via `POST /daily-api/forex/collect`, but has no read endpoint. This plan adds a **ForexKit-compatible read endpoint** under `app-api`.

## Proposed Route

```
GET /app-api/forex/latest?base=EUR&symbols=USD,GBP
```

ForexKit users would configure: `forexBaseURL = http://<server>/app-api/forex`

## What ForexKit Requires

Based on `ForexAPI.swift`:

- **Only** `GET {forexBaseURL}/latest` is called
- Query params:
  - `base`: currency code (default `EUR` if absent or invalid)
  - `symbols`: optional comma-separated list; if absent/`*`, all rates are returned
- Response shape must match `ExchangeRates` Swift struct:
  - `base: String` (currency code)
  - `date: String` (YYYY-MM-DD format)
  - `rates: [String: Double]` (target currency → rate)
- 404 when no data is available
- No auth required (ForexKit passes no auth headers)

## New Files

1. **`server/src/forex/schemas/latest.ts`**
   - `ForexLatestQuerySchema`: optional `base` (default `"EUR"`), optional `symbols`
   - `ForexLatestResponseSchema`: `{ base: string, date: string, rates: Record<string, number> }`

2. **`server/src/forex/routes/latest.ts`**
   - `GET /latest` OpenAPI route definition

3. **`server/src/forex/handlers/latest.ts`**
   - Normalize `base` (uppercase, validate against `CURRENCIES`, fallback to `"EUR"`)
   - Query `exchange_rates` table: `WHERE base = ? ORDER BY date DESC LIMIT 1`
   - Return 404 if no row found
   - If `symbols` provided: filter `rates` to only the requested currencies
   - Log start + outcome
   - Return `{ base, date, rates }` with 200

4. **`server/src/forex/routes/app.ts`**
   - New Hono router (no auth middleware — public endpoint)
   - Mount `latestRoute` → `latestHandler`
   - Export as `forexCompatApi`

5. **`server/src/forex/tests/latest.integration.test.ts`**
   - Seed `exchange_rates` table with test data before each test
   - Test cases:
     - Returns latest rates for default base (`EUR`)
     - Returns rates for explicit `base` param
     - Filters rates by `symbols` param
     - Returns all rates when `symbols` is absent
     - Returns 404 when DB has no data for the requested base
     - Invalid/unknown `base` falls back to `EUR`
     - Response shape exactly matches ForexKit contract (`base`, `date`, `rates`)

## Modified Files

1. **`server/src/forex/index.ts`**
   - Add export: `forexCompatApi` and `FOREX_COMPAT_ROUTE_NAME` (reuse existing `ROUTE_NAME = '/forex'`)

2. **`server/src/app-api/index.ts`**
   - Mount `forexCompatApi` under `FOREX_ROUTE_NAME`

## Behaviour Details

- **Base normalization**: uppercase + trim → validate against `CURRENCIES` set → default to `"EUR"` if invalid
- **Symbols filtering**: parse comma-separated string → uppercase → filter to known `CURRENCIES` → exclude `base` itself → filter `rates` map
- **DB query**: select latest row by `date DESC` for the given base (the collect job populates all cross-rates via `calculateRates()`)
- **Date format**: the `date` column is stored as `YYYY-MM-DD` text — return it as-is

## Testing Strategy

Integration tests seed the DB directly, exercise the full HTTP stack, and assert:

- Correct HTTP status codes
- Response body matches ForexKit's expected `ExchangeRates` shape
- Symbol filtering works correctly
- Fallback behaviour for invalid inputs
- Structured log events are emitted (`forex.latest.started`, `forex.latest.completed`, `forex.latest.not_found`)
