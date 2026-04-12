# Export/Import Transactions Feature

## Problem Statement
Add Export and Import buttons to the macOS settings screen so users can back up and restore their portfolio transactions as CSV files. The CSV must include transaction IDs to prevent duplicates on re-import. The server needs a new bulk-create endpoint since import may add many transactions at once.

## Approach
- **Server**: New `POST /portfolio/entries/bulk` endpoint that accepts an array of entries with optional client-supplied IDs; transactions whose IDs already exist in the database are silently skipped (idempotent).
- **KowalskiClient**: Extend the Swift client with a `bulkCreateEntries` method backed by the new endpoint.
- **KowalskiPortfolio**: Add `exportTransactions()` (returns a CSV file URL) and `importTransactions(from:)` (parses CSV, calls `bulkCreateEntries`, refreshes overview).
- **KowalskiAuthSettingsView**: Keep `KowalskiPortfolio` out of the `KowalskiAuth` package (no circular dep) by injecting callbacks from the outside. Add a "Data" pane that appears when those callbacks are provided.
- **KowalskiApp / KowalskiScene**: Pass `portfolio.exportTransactions` and `portfolio.importTransactions` into the settings view; add `portfolio` to the settings environment.

## CSV Format
```
id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
550e8400-...,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z
```
- All columns required; template download produces headers-only file.

## Todos

### Server — implementation
1. Add `BulkCreateEntryItemPayloadSchema` (extends `CreateEntryPayload` with optional `id` field)
2. Add `BulkCreateEntriesPayloadSchema` (wrapper object `{ entries: [...] }`)
3. Add `BulkCreateEntriesResponseSchema` (array of `CreateEntryResponse`)
4. Add `POST /entries/bulk` route definition (`server/src/portfolio/routes/bulk-create-entries.ts`)
5. Add `findPortfolioTransactionsByIds` repository function (used for duplicate check)
6. Add `bulk-create-entries` service (iterate payload entries, skip existing IDs, create new ones)
7. Add `bulk-create-entries` handler — log `portfolio.entries.bulk_created` with `created_count`, `skipped_count`, `total_count`, `outcome: 'success'` using `logInfo` + `withRequestLogger`
8. Register the route in `server/src/portfolio/routes/index.ts`

### Server — integration tests
Tests in `server/src/portfolio/tests/bulk-create-entries.integration.test.ts` that read as a specification:
- **All new entries are created**: POST 3 entries with unused IDs → 201, response contains all 3, DB has 3 new rows; log includes `created_count: 3, skipped_count: 0`
- **Duplicate IDs are silently skipped**: POST 2 entries whose IDs already exist → 201, response is `[]`, DB count unchanged; log includes `created_count: 0, skipped_count: 2`
- **Mixed batch — new entries created, duplicates skipped**: POST 3 entries where 1 ID already exists → 201, response has 2 new entries, DB +2; log includes `created_count: 2, skipped_count: 1`
- **Empty entries array is accepted**: POST `{ entries: [] }` → 201 with `[]`; log includes `created_count: 0, skipped_count: 0`
- **Unauthenticated request is rejected**: no session token → 401

### KowalskiClient — implementation
10. Add `KowalskiPortfolioBulkCreateEntryItemPayload` (payload + optional `id: String?`)
11. Add `KowalskiPortfolioClientBulkCreateEntriesErrors` error enum
12. Update `KowalskiPortfolioClient` protocol with `bulkCreateEntries` method
13. Implement `bulkCreateEntries` in `KowalskiPortfolioClientImpl`
14. Update preview implementation to handle `bulkCreateEntries`
15. Update `KowalskiPortfolioMapper` for bulk payload/response mapping

### KowalskiClient — unit tests
New tests in `KowalskiPortfolioClientTests.swift`:
- **Sends correct HTTP request**: `bulkCreateEntries` sends `POST /app-api/portfolio/entries/bulk`; body is `{ "entries": [...] }` with `id` present when supplied and absent when nil
- **Maps success response**: 201 with 2 entry objects → returns array of 2 decoded `KowalskiPortfolioClientEntryResponse` with correct fields
- **Empty success**: 201 with `[]` → returns empty array
- **Internal server error**: 500 → `.internalServerError`
- **Unauthorized**: 401 → `.unauthorized`

### KowalskiFeatures / KowalskiPortfolio — implementation
16. Add `exportTransactions()` — serialise `entries` to CSV, write to temp file, return `Result<URL, ExportTransactionErrors>`; log info on success (`"Exported X transactions to CSV"`), log error on write failure
17. Add `importTransactions(from url: URL)` — parse CSV rows (log `warning` per malformed row, skip and continue); call `bulkCreateEntries` (log error on failure); refresh overview (log error on failure); log info on completion with `imported_count`; return `Result<Void, ImportTransactionErrors>`
18. Add `ExportTransactionErrors` and `ImportTransactionErrors` enums

### KowalskiFeatures / KowalskiPortfolio — unit tests
New tests in `KowalskiPortfolioTests.swift`:
- **Export CSV has correct header row**: export from a portfolio with entries → first line equals the expected comma-separated header string
- **Export encodes all fields including id**: single entry → the data row contains the entry's `id`, `symbol`, `amount`, `transaction_type`, etc. in the correct columns
- **Export with no entries produces a headers-only file**: no entries → CSV has exactly 1 line
- **Import calls bulkCreateEntries with parsed payload**: valid CSV with 2 rows → `bulkCreateEntries` called once with 2 items carrying the correct `id`, `symbol`, `amount`, etc.
- **Import refreshes overview after success**: after successful import `entries` is updated from the mock overview response
- **Import returns error on malformed CSV**: CSV missing required columns → `.invalidFormat` error, `bulkCreateEntries` never called

### KowalskiFeatures / KowalskiAuth — settings UI
19. Add `onExportTransactions`, `onImportTransactions`, `onDownloadTransactionsTemplate` callback params to `KowalskiAuthSettingsView`
20. Add `.data` case to `KowalskiAuthSettingsPane` (shown only when callbacks are non-nil)
21. Implement `dataSettingsPane` — Export button + Import button
22. Implement import sheet — format explanation text, "Download CSV Template" button, "Choose File…" file importer

### KowalskiApp
23. Update `KowalskiScene.swift` — pass export/import callbacks and `portfolio` environment to `KowalskiAuthSettingsView`

### Spec & Build
24. Run `just download-spec` to regenerate `openapi.yaml`
25. Run `just ready` to verify everything passes

## Notes
- The bulk endpoint is idempotent: repeated imports with the same IDs add no duplicates.
- "sector", "industry", "exchange_dispatch" columns may be empty strings in CSV; treat as `null` in the API.
- Settings frame is currently `500×400`; it may need to be slightly taller for the new Data pane (or keep same size and use `ScrollView`).
- Preview implementations in `KowalskiPortfolioClientFactory` follow existing factory patterns.
