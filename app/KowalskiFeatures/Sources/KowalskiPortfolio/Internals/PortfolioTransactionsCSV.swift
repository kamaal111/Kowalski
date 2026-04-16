//
//  PortfolioTransactionsCSV.swift
//  KowalskiPortfolio
//
//  Created by OpenAI Codex on 4/12/26.
//

import Foundation
import KamaalExtensions
import KamaalLogger
import KowalskiClient
import KowalskiUtils
import TabularData

private let logger = KamaalLogger(from: PortfolioTransactionsCSV.self, failOnError: true)

struct PortfolioTransactionsCSVImportResult {
    let entries: [KowalskiPortfolioBulkCreateEntryItemPayload]
    let malformedRowNumbers: [Int]

    init(entries: [KowalskiPortfolioBulkCreateEntryItemPayload] = [], malformedRowNumbers: [Int] = []) {
        self.entries = entries
        self.malformedRowNumbers = malformedRowNumbers
    }

    func withEntries(_ entries: [KowalskiPortfolioBulkCreateEntryItemPayload]) -> PortfolioTransactionsCSVImportResult {
        PortfolioTransactionsCSVImportResult(entries: entries, malformedRowNumbers: malformedRowNumbers)
    }

    func withEntriesAppended(
        _ entry: KowalskiPortfolioBulkCreateEntryItemPayload,
    ) -> PortfolioTransactionsCSVImportResult {
        withEntries(entries.appended(entry))
    }

    func withMalformedRowNumbers(_ malformedRowNumbers: [Int]) -> PortfolioTransactionsCSVImportResult {
        PortfolioTransactionsCSVImportResult(entries: entries, malformedRowNumbers: malformedRowNumbers)
    }

    func withMalformedRowNumbersAppended(_ malformedRowNumber: Int) -> PortfolioTransactionsCSVImportResult {
        withMalformedRowNumbers(malformedRowNumbers.appended(malformedRowNumber))
    }
}

enum PortfolioTransactionsCSVError: Error, Equatable {
    case invalidFormat
    case readFailed(Error)
    case writeFailed(Error)

    static func == (lhs: PortfolioTransactionsCSVError, rhs: PortfolioTransactionsCSVError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidFormat, .invalidFormat), (.readFailed, .readFailed), (.writeFailed, .writeFailed):
            true
        default:
            false
        }
    }
}

enum PortfolioTransactionsCSV {
    private static let exportPrefixName = "portfolio-transactions"

    private struct ScannedCSVRecord {
        let startLineNumber: Int
        let contents: String
        let isMalformed: Bool
    }

    private enum HeaderField: String, CaseIterable {
        case id
        case symbol
        case exchange
        case name
        case isin
        case sector
        case industry
        case exchangeDispatch = "exchange_dispatch"
        case amount
        case purchasePriceCurrency = "purchase_price_currency"
        case purchasePriceValue = "purchase_price_value"
        case transactionType = "transaction_type"
        case transactionDate = "transaction_date"
    }

    private static let headerFields = HeaderField.allCases.map(\.rawValue)
    private static let csvColumnTypes = HeaderField.allCases.reduce([String: CSVType]()) { result, header in
        result.merged(with: [header.rawValue: .string])
    }

    static func export(entries: [PortfolioEntry]) -> Result<URL, PortfolioTransactionsCSVError> {
        let result = write(rows: entries.map(makeRow), filenamePrefix: exportPrefixName)
        switch result {
        case .success:
            logger.info("Exported \(entries.count) transactions to CSV")
        case let .failure(error):
            logExportError(error, context: "transactions")
        }

        return result
    }

    static func exportTemplate() -> Result<URL, PortfolioTransactionsCSVError> {
        let result = write(rows: [], filenamePrefix: "\(exportPrefixName)-template")
        switch result {
        case .success:
            logger.info("Exported transactions CSV template")
        case let .failure(error):
            logExportError(error, context: "transactions CSV template")
        }

        return result
    }

    static func `import`(from url: URL) -> Result<PortfolioTransactionsCSVImportResult, PortfolioTransactionsCSVError> {
        let contents: String
        do {
            contents = try SecurityScopedFileAccess.readString(from: url)
        } catch {
            let csvError = PortfolioTransactionsCSVError.readFailed(error)
            logImportError(csvError)

            return .failure(csvError)
        }

        let result = parseImportResult(from: contents)
        switch result {
        case let .failure(failure):
            logImportError(failure)
        case let .success(success):
            for rowNumber in success.malformedRowNumbers {
                logger.warning("Skipping malformed transactions CSV row \(rowNumber)")
            }
        }

        return result
    }

    private static func logExportError(_ error: PortfolioTransactionsCSVError, context: String) {
        switch error {
        case let .writeFailed(writeError):
            logger.error(label: "Failed to export \(context)", error: writeError)
        case let .readFailed(readError):
            logger.error(label: "Unexpected CSV read error during \(context) export", error: readError)
        case .invalidFormat:
            logger.error("Unexpected invalid CSV state during \(context) export")
        }
    }

    private static func logImportError(_ error: PortfolioTransactionsCSVError) {
        switch error {
        case .invalidFormat:
            break
        case let .readFailed(readError):
            logger.error(label: "Failed to read imported transactions CSV", error: readError)
        case let .writeFailed(writeError):
            logger.error(label: "Unexpected CSV write error during import", error: writeError)
        }
    }

    private static func write(
        rows: [[String]],
        filenamePrefix: String,
    ) -> Result<URL, PortfolioTransactionsCSVError> {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(filenamePrefix)-\(UUID().uuidString)")
            .appendingPathExtension("csv")
        let frame = makeDataFrame(rows: rows)
        do {
            try frame.writeCSV(to: url, options: makeCSVWritingOptions())
        } catch {
            return .failure(.writeFailed(error))
        }

        return .success(url)
    }

    private static func makeDataFrame(rows: [[String]]) -> DataFrame {
        let columns = HeaderField.allCases
            .enumerated()
            .map { pair in
                let (offset, header) = pair
                let contents = rows.map { row in
                    if row.indices.contains(offset) { row[offset] } else { "" }
                }

                return Column(name: header.rawValue, contents: contents).eraseToAnyColumn()
            }

        return DataFrame(columns: columns)
    }

    private static func parseImportResult(
        from contents: String,
    ) -> Result<PortfolioTransactionsCSVImportResult, PortfolioTransactionsCSVError> {
        switch parseDataFrame(from: contents) {
        case let .success(frame): makeImportResult(from: frame)
        case .failure: recoverImportResult(from: contents)
        }
    }

    private static func parseDataFrame(from contents: String) -> Result<DataFrame, PortfolioTransactionsCSVError> {
        do {
            let result = try DataFrame(
                csvData: Data(contents.utf8),
                types: csvColumnTypes,
                options: makeCSVReadingOptions(),
            )
            return .success(result)
        } catch {
            return .failure(.readFailed(error))
        }
    }

    private static func makeImportResult(
        from frame: DataFrame,
    ) -> Result<PortfolioTransactionsCSVImportResult, PortfolioTransactionsCSVError> {
        guard hasRequiredHeaders(frame.columns.map(\.name)) else { return .failure(.invalidFormat) }

        let result = frame.rows
            .enumerated()
            .reduce(PortfolioTransactionsCSVImportResult()) { partial, pair in
                let (index, row) = pair
                let rowNumber = index + 2
                let rowValues = makeRowValues(from: row)
                guard let entry = makeEntry(from: rowValues) else {
                    return partial.withMalformedRowNumbersAppended(rowNumber)
                }

                return partial.withEntriesAppended(entry)
            }

        return .success(result)
    }

    private static func recoverImportResult(
        from contents: String,
    ) -> Result<PortfolioTransactionsCSVImportResult, PortfolioTransactionsCSVError> {
        let scannedRecords = scanRecords(in: contents)
        guard let headerRecord = firstHeaderRecord(from: scannedRecords) else { return .failure(.invalidFormat) }
        guard validateHeaderRecord(headerRecord.contents) else { return .failure(.invalidFormat) }

        let result = scannedRecords
            .drop { record in record.startLineNumber != headerRecord.startLineNumber }
            .dropFirst()
            .reduce(PortfolioTransactionsCSVImportResult(entries: [], malformedRowNumbers: [])) { partial, record in
                guard !record.contents.isEmpty else { return partial }
                guard !record.isMalformed else {
                    return partial.withMalformedRowNumbersAppended(record.startLineNumber)
                }

                let csvContents = [headerRecord.contents, record.contents].joined(separator: "\n")
                guard let parsedRow = parseSingleRow(from: csvContents) else {
                    return partial.withMalformedRowNumbersAppended(record.startLineNumber)
                }
                guard let entry = makeEntry(from: parsedRow) else {
                    return partial.withMalformedRowNumbersAppended(record.startLineNumber)
                }

                return partial.withEntriesAppended(entry)
            }

        return .success(result)
    }

    private static func makeRow(for entry: PortfolioEntry) -> [String] {
        HeaderField.allCases.map { value(for: $0, in: entry) }
    }
}

private extension PortfolioTransactionsCSV {
    private static func firstHeaderRecord(from scannedRecords: [ScannedCSVRecord]) -> ScannedCSVRecord? {
        for record in scannedRecords where !record.contents.isEmpty {
            guard !record.isMalformed else { return nil }
            return record
        }

        return nil
    }

    private static func validateHeaderRecord(_ contents: String) -> Bool {
        let result = try? parseDataFrame(from: contents)
            .map { hasRequiredHeaders($0.columns.map(\.name)) }
            .get()
        return result ?? false
    }

    private static func parseSingleRow(from contents: String) -> [HeaderField: String]? {
        guard let frame = try? parseDataFrame(from: contents).get() else { return nil }
        guard hasRequiredHeaders(frame.columns.map(\.name)) else { return nil }
        guard frame.rows.count == 1 else { return nil }

        return makeRowValues(from: frame.rows[0])
    }

    private static func hasRequiredHeaders(_ columns: [String]) -> Bool {
        let availableColumns = Set(columns)

        return HeaderField.allCases.allSatisfy { availableColumns.contains($0.rawValue) }
    }

    private static func scanRecords(in contents: String) -> [ScannedCSVRecord] {
        var records: [ScannedCSVRecord] = []
        var currentRecord = ""
        var currentRecordStartLine = 1
        var currentLineNumber = 1
        let characters = Array(contents)
        var index = 0
        var isInsideQuotes = false

        while index < characters.count {
            let character = characters[index]
            let nextIndex = characters.index(after: index)
            let nextCharacter = nextIndex < characters.endIndex ? characters[nextIndex] : nil

            if character == "\"" {
                if isInsideQuotes, nextCharacter == "\"" {
                    currentRecord.append(character)
                    currentRecord.append("\"")
                    index += 2
                    continue
                }

                isInsideQuotes.toggle()
                currentRecord.append(character)
                index += 1
                continue
            }

            if character == "\n" || character == "\r" {
                let lineBreak = if character == "\r", nextCharacter == "\n" {
                    "\r\n"
                } else {
                    String(character)
                }

                if isInsideQuotes {
                    currentRecord.append(lineBreak)
                } else {
                    records.append(
                        ScannedCSVRecord(
                            startLineNumber: currentRecordStartLine,
                            contents: currentRecord,
                            isMalformed: false,
                        ),
                    )
                    currentRecord = ""
                    currentRecordStartLine = currentLineNumber + 1
                }

                currentLineNumber += 1
                index += lineBreak.count
                continue
            }

            currentRecord.append(character)
            index += 1
        }

        if !currentRecord.isEmpty || contents.isEmpty {
            records.append(
                ScannedCSVRecord(
                    startLineNumber: currentRecordStartLine,
                    contents: currentRecord,
                    isMalformed: isInsideQuotes,
                ),
            )
        }

        return records
    }
}

private extension PortfolioTransactionsCSV {
    private static func makeCSVReadingOptions() -> CSVReadingOptions {
        CSVReadingOptions(
            hasHeaderRow: true,
            nilEncodings: [],
            trueEncodings: ["1", "True", "TRUE", "true"],
            falseEncodings: ["0", "False", "FALSE", "false"],
            floatingPointType: .double,
            ignoresEmptyLines: true,
            usesQuoting: true,
            usesEscaping: false,
            delimiter: ",",
            escapeCharacter: "\\",
        )
    }

    private static func makeCSVWritingOptions() -> CSVWritingOptions {
        CSVWritingOptions(
            includesHeader: true,
            nilEncoding: "",
            trueEncoding: "true",
            falseEncoding: "false",
            newline: "\n",
            delimiter: ",",
        )
    }

    private static func value(for headerField: HeaderField, in entry: PortfolioEntry) -> String {
        switch headerField {
        case .id:
            entry.id
        case .symbol:
            entry.stock.symbol
        case .exchange:
            entry.stock.exchange
        case .name:
            entry.stock.name
        case .isin:
            entry.stock.isin ?? ""
        case .sector:
            entry.stock.sector ?? ""
        case .industry:
            entry.stock.industry ?? ""
        case .exchangeDispatch:
            entry.stock.exchangeDispatch ?? ""
        case .amount:
            String(entry.amount)
        case .purchasePriceCurrency:
            entry.purchasePrice.currency.rawValue
        case .purchasePriceValue:
            String(entry.purchasePrice.value)
        case .transactionType:
            entry.transactionType.csvValue
        case .transactionDate:
            makeDateFormatter(withFractionalSeconds: true).string(from: entry.transactionDate)
        }
    }

    private static func makeRowValues(from row: DataFrame.Row) -> [HeaderField: String] {
        HeaderField.allCases.reduce(into: [HeaderField: String]()) { result, header in
            result[header] = row[header.rawValue, String.self] ?? ""
        }
    }

    private static func makeEntry(
        from row: [HeaderField: String],
    ) -> KowalskiPortfolioBulkCreateEntryItemPayload? {
        guard let id = requiredValue(.id, row: row) else { return nil }
        guard let symbol = requiredValue(.symbol, row: row) else { return nil }
        guard let exchange = requiredValue(.exchange, row: row) else { return nil }
        guard let name = requiredValue(.name, row: row) else { return nil }
        guard let isin = requiredValue(.isin, row: row) else { return nil }
        guard let amountValue = requiredValue(.amount, row: row) else { return nil }
        guard let amount = Double(amountValue) else { return nil }
        guard let purchasePriceCurrency = requiredValue(.purchasePriceCurrency, row: row) else { return nil }
        guard let purchasePriceValue = requiredValue(.purchasePriceValue, row: row) else { return nil }
        guard let purchasePrice = Double(purchasePriceValue) else { return nil }
        guard let transactionTypeValue = requiredValue(.transactionType, row: row) else { return nil }
        guard let transactionType = KowalskiClientPortfolioTransactionTypes(csvValue: transactionTypeValue)
        else { return nil }
        guard let transactionDateValue = requiredValue(.transactionDate, row: row) else { return nil }
        guard let transactionDate = parseDate(transactionDateValue) else { return nil }

        return KowalskiPortfolioBulkCreateEntryItemPayload(
            id: id,
            stock: KowalskiClientStockItem(
                symbol: symbol,
                exchange: exchange,
                name: name,
                isin: isin,
                sector: optionalValue(.sector, row: row),
                industry: optionalValue(.industry, row: row),
                exchangeDispatch: optionalValue(.exchangeDispatch, row: row),
            ),
            amount: amount,
            purchasePrice: KowalskiClientMoney(currency: purchasePriceCurrency, value: purchasePrice),
            transactionType: transactionType,
            transactionDate: transactionDate,
        )
    }

    private static func requiredValue(
        _ header: HeaderField,
        row: [HeaderField: String],
    ) -> String? {
        guard let value = value(for: header, row: row) else { return nil }
        guard !value.isEmpty else { return nil }

        return value
    }

    private static func optionalValue(
        _ header: HeaderField,
        row: [HeaderField: String],
    ) -> String? {
        guard let value = value(for: header, row: row) else { return nil }
        guard !value.isEmpty else { return nil }

        return value
    }

    private static func value(
        for header: HeaderField,
        row: [HeaderField: String],
    ) -> String? {
        guard let value = row[header] else { return nil }

        return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func parseDate(_ value: String) -> Date? {
        makeDateFormatter(withFractionalSeconds: true).date(from: value)
            ?? makeDateFormatter(withFractionalSeconds: false).date(from: value)
    }

    private static func makeDateFormatter(withFractionalSeconds: Bool) -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = withFractionalSeconds
            ? [.withInternetDateTime, .withFractionalSeconds]
            : [.withInternetDateTime]

        return formatter
    }
}

private extension TransactionType {
    var csvValue: String {
        switch self {
        case .purchase: "buy"
        case .sell: "sell"
        case .split: "split"
        }
    }
}

private extension KowalskiClientPortfolioTransactionTypes {
    init?(csvValue: String) {
        switch csvValue.lowercased() {
        case "buy":
            self = .buy
        case "sell":
            self = .sell
        case "split":
            self = .split
        default:
            return nil
        }
    }
}
