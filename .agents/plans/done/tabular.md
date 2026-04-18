# Replace `SwiftCSV` with `TabularData` in `KowalskiPortfolio`

## Summary

Migrate the CSV import/export logic in [PortfolioTransactionsCSV.swift](app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/PortfolioTransactionsCSV.swift) from `SwiftCSV` to Apple `TabularData`, remove the `SwiftCSV` package from [Package.swift](app/KowalskiFeatures/Package.swift), and preserve the current import contract.

Chosen defaults to lock the spec:

- Preserve current row-tolerant import behavior for malformed rows.
- Use `TabularData` for both import and export/template generation.
- Keep all public `KowalskiPortfolio` APIs and error cases unchanged.

## Implementation Changes

### 1. Add characterization coverage before touching production code

Extend [KowalskiPortfolioTests.swift](app/KowalskiFeatures/Tests/KowalskiPortfolioTests/KowalskiPortfolioTests.swift) first, then run the CSV-focused tests against the existing `SwiftCSV` implementation.

Add tests that lock down currently unprotected behavior:

- Export round-trip for fields containing commas, embedded quotes, and quoted newlines.
- Export should write blank optional stock fields as empty cells, not `"nil"`.
- Export/import should preserve `split` transaction type.
- Import should accept ISO-8601 timestamps both with and without fractional seconds.
- Import should ignore empty lines between data rows.
- Import should trim surrounding whitespace from cell values before validation.
- Import should treat required fields that become empty after trimming as malformed rows.
- Keep the existing regression for unterminated quoted fields returning success with `malformedRowNumbers` rather than failing the whole file.

Do not weaken the existing tests that already cover:

- Required-header failure as `invalidFormat`
- Quoted newline + escaped quote parsing
- Skipping semantically malformed rows with correct row numbers
- `importTransactions(from:)` wiring into `bulkCreateEntries` and refresh

### 2. Replace the reader with a `TabularData`-based parser

Keep file access, logging, entry mapping, and error mapping in place; only replace CSV parsing internals.

Use this structure:

- Remove `import SwiftCSV`; add `import TabularData`.
- Keep `HeaderField`, `requiredValue`, `optionalValue`, `parseDate`, and the existing transaction-type mapping.
- Read the file contents exactly as today through `SecurityScopedFileAccess.readString(from:)`.

Primary parse path:

- Parse the full CSV with `DataFrame(csvData:options:)`.
- Use `CSVReadingOptions` with header row enabled, empty-line ignoring enabled, comma delimiter, quoting enabled, escaping disabled.
- Force all known CSV columns to `.string` via the `types:` dictionary so `TabularData` does not infer numeric/date types and change current parsing semantics.
- Validate headers by column name, requiring every `HeaderField`.
- Iterate `frame.rows.enumerated()` and convert each row into `KowalskiPortfolioBulkCreateEntryItemPayload` using the existing per-field validation rules.
- Keep row numbers as `index + 2`.

Compatibility fallback for structurally broken rows:

- If `TabularData` throws `CSVReadingError`, do not immediately fail the whole file.
- Scan the raw CSV into logical records with a small private record scanner that tracks:
  - record start line
  - quote state
  - doubled `""` inside quoted fields
  - embedded newlines inside quoted fields
- Emit either a balanced record or a malformed record starting at a specific source line.
- Parse the header record separately with `TabularData`; if the header itself is malformed or missing required columns, return `.invalidFormat`.
- For each balanced data record, parse `header + record` with `TabularData` and map the single parsed row.
- For each malformed record, append its starting source line to `malformedRowNumbers` and continue.
- If a balanced record parses but fails field-level validation, keep the current behavior and mark that row malformed rather than failing the file.

This keeps `TabularData` as the parser for valid records while preserving the current malformed-row recovery contract.

### 3. Move export/template generation onto `TabularData`

Replace the manual string-joining writer with a `DataFrame` writer.

Writer rules:

- Build one `Column<String>` per `HeaderField` in exact header order.
- Export all values as strings, not typed doubles/dates, so the output stays aligned with current formatting:
  - `String(entry.amount)`
  - `String(entry.purchasePrice.value)`
  - ISO-8601 date string from the existing formatter
  - empty string for absent optional values
- Use `CSVWritingOptions` with header inclusion on, comma delimiter, newline `\n`, and empty-string nil encoding.
- Write both the populated export and the headers-only template through `TabularData` instead of the current custom CSV joiner.
- Keep the current temp-file naming and `PortfolioTransactionsCSVError.writeFailed` mapping.

### 4. Remove the dependency cleanly

Update package wiring after the code is migrated:

- Delete the `SwiftCSV` package dependency from `app/KowalskiFeatures/Package.swift`.
- Remove `"SwiftCSV"` from the `KowalskiPortfolio` target dependencies.
- Refresh SwiftPM resolution for the feature package, app package, and Xcode workspace so all tracked `Package.resolved` files drop `swiftcsv`.

No public interfaces should change:

- `KowalskiPortfolio.exportTransactions()`
- `KowalskiPortfolio.downloadTransactionsTemplate()`
- `KowalskiPortfolio.importTransactions(from:)`
- `ImportTransactionErrors` / `ExportTransactionErrors`

## Test Plan

Run in this order:

1. Baseline: run the CSV-focused `KowalskiPortfolioTests` after adding the new characterization tests and confirm they pass under the current `SwiftCSV` implementation.
2. After migration: rerun the same portfolio test coverage and confirm behavior is unchanged.
3. Build verification: run `swift build` in `app/KowalskiFeatures`.
4. Repo verification: run `just test`.
5. Final gate: run `just ready`.

Acceptance criteria:

- No remaining `SwiftCSV` imports or package references.
- CSV import/export/template tests all pass.
- Unterminated quoted-field behavior still returns partial success with the malformed row reported, not a file-level failure.
- Exported CSV still round-trips through import for representative portfolio rows.
- `just ready` passes before the task is considered complete.

## Assumptions

- Current behavior is the contract unless explicitly contradicted by the chosen defaults above.
- Extra CSV columns remain ignored.
- Missing required headers still fail the whole import as `invalidFormat`.
- Row-level semantic errors still produce `malformedRowNumbers` and partial success.
- All new parser/writer helpers stay private inside `PortfolioTransactionsCSV.swift` unless the file becomes unreadable, in which case split only private helpers into a sibling internal file without changing module API.
