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
import SwiftCSV

private let logger = KamaalLogger(from: PortfolioTransactionsCSV.self, failOnError: true)

struct PortfolioTransactionsCSVImportResult {
    let entries: [KowalskiPortfolioBulkCreateEntryItemPayload]
    let malformedRowNumbers: [Int]
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

    static func export(entries: [PortfolioEntry]) -> Result<URL, PortfolioTransactionsCSVError> {
        let rows = [headerFields] + entries.map(makeRow)
        let result = write(rows: rows, filenamePrefix: "portfolio-transactions")

        switch result {
        case .success:
            logger.info("Exported \(entries.count) transactions to CSV")
        case let .failure(error):
            logExportError(error, context: "transactions")
        }

        return result
    }

    static func exportTemplate() -> Result<URL, PortfolioTransactionsCSVError> {
        let result = write(rows: [headerFields], filenamePrefix: "portfolio-transactions-template")

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
        let rows: [[String]]
        do {
            rows = try parseRows(contents)
        } catch let error as PortfolioTransactionsCSVError {
            logImportError(error)
            return .failure(error)
        } catch {
            let csvError = PortfolioTransactionsCSVError.readFailed(error)
            logImportError(csvError)

            return .failure(csvError)
        }
        guard let headerRow = rows.first else { return .failure(.invalidFormat) }
        guard let headerIndexes = makeHeaderIndexes(headerRow) else { return .failure(.invalidFormat) }

        let result = rows
            .dropFirst()
            .enumerated()
            .reduce(PortfolioTransactionsCSVImportResult(entries: [], malformedRowNumbers: [])) {
                let (index, row) = $1
                let rowNumber = index + 2
                guard let entry = makeEntry(from: row, headerIndexes: headerIndexes) else {
                    return PortfolioTransactionsCSVImportResult(
                        entries: $0.entries,
                        malformedRowNumbers: $0.malformedRowNumbers.appended(rowNumber),
                    )
                }

                return PortfolioTransactionsCSVImportResult(
                    entries: $0.entries.appended(entry),
                    malformedRowNumbers: $0.malformedRowNumbers,
                )
            }
        for rowNumber in result.malformedRowNumbers {
            logger.warning("Skipping malformed transactions CSV row \(rowNumber)")
        }

        return .success(result)
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
        let csvContents = rows.map(makeCSVLine).joined(separator: "\n").appending("\n")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(filenamePrefix)-\(UUID().uuidString)")
            .appendingPathExtension("csv")

        do {
            try csvContents.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            return .failure(.writeFailed(error))
        }

        return .success(url)
    }

    private static func makeRow(for entry: PortfolioEntry) -> [String] {
        HeaderField.allCases.map { value(for: $0, in: entry) }
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

    private static func makeCSVLine(from fields: [String]) -> String {
        fields.map(escapeField).joined(separator: ",")
    }

    private static func escapeField(_ field: String) -> String {
        let needsQuotes = field.contains(",") || field.contains("\"") || field.contains("\n") || field.contains("\r")
        guard needsQuotes else { return field }

        return "\"\(field.replacingOccurrences(of: "\"", with: "\"\""))\""
    }

    private static func parseRows(_ contents: String) throws -> [[String]] {
        do {
            let csv = try EnumeratedCSV(string: contents, delimiter: .comma, loadColumns: false)
            let rows = [csv.header] + csv.rows

            return rows.filter { !isEmptyRow($0) }
        } catch is CSVParseError {
            throw PortfolioTransactionsCSVError.invalidFormat
        }
    }

    private static func makeHeaderIndexes(_ headerRow: [String]) -> [HeaderField: Int]? {
        let headerIndexes = headerRow.enumerated().reduce(into: [HeaderField: Int]()) { result, pair in
            guard let headerField = HeaderField(rawValue: pair.element) else { return }
            result[headerField] = pair.offset
        }
        guard HeaderField.allCases.allSatisfy({ headerIndexes[$0] != nil }) else { return nil }

        return headerIndexes
    }

    private static func makeEntry(
        from row: [String],
        headerIndexes: [HeaderField: Int],
    ) -> KowalskiPortfolioBulkCreateEntryItemPayload? {
        guard let id = requiredValue(.id, row: row, headerIndexes: headerIndexes) else { return nil }
        guard let symbol = requiredValue(.symbol, row: row, headerIndexes: headerIndexes) else { return nil }
        guard let exchange = requiredValue(.exchange, row: row, headerIndexes: headerIndexes) else { return nil }
        guard let name = requiredValue(.name, row: row, headerIndexes: headerIndexes) else { return nil }
        guard let isin = requiredValue(.isin, row: row, headerIndexes: headerIndexes) else { return nil }
        guard let amountValue = requiredValue(.amount, row: row, headerIndexes: headerIndexes) else { return nil }
        guard let amount = Double(amountValue) else { return nil }
        guard let purchasePriceCurrency = requiredValue(
            .purchasePriceCurrency,
            row: row,
            headerIndexes: headerIndexes,
        )
        else { return nil }
        guard let purchasePriceValue = requiredValue(.purchasePriceValue, row: row, headerIndexes: headerIndexes)
        else { return nil }
        guard let purchasePrice = Double(purchasePriceValue) else { return nil }
        guard let transactionTypeValue = requiredValue(.transactionType, row: row, headerIndexes: headerIndexes)
        else { return nil }
        guard let transactionType = KowalskiClientPortfolioTransactionTypes(csvValue: transactionTypeValue)
        else { return nil }
        guard let transactionDateValue = requiredValue(.transactionDate, row: row, headerIndexes: headerIndexes)
        else { return nil }
        guard let transactionDate = parseDate(transactionDateValue) else { return nil }

        return KowalskiPortfolioBulkCreateEntryItemPayload(
            id: id,
            stock: KowalskiClientStockItem(
                symbol: symbol,
                exchange: exchange,
                name: name,
                isin: isin,
                sector: optionalValue(.sector, row: row, headerIndexes: headerIndexes),
                industry: optionalValue(.industry, row: row, headerIndexes: headerIndexes),
                exchangeDispatch: optionalValue(.exchangeDispatch, row: row, headerIndexes: headerIndexes),
            ),
            amount: amount,
            purchasePrice: KowalskiClientMoney(currency: purchasePriceCurrency, value: purchasePrice),
            transactionType: transactionType,
            transactionDate: transactionDate,
        )
    }

    private static func requiredValue(
        _ header: HeaderField,
        row: [String],
        headerIndexes: [HeaderField: Int],
    ) -> String? {
        guard let value = value(
            for: header,
            row: row,
            headerIndexes: headerIndexes,
        )
        else { return nil }
        guard !value.isEmpty else { return nil }

        return value
    }

    private static func optionalValue(
        _ header: HeaderField,
        row: [String],
        headerIndexes: [HeaderField: Int],
    ) -> String? {
        guard let value = value(
            for: header,
            row: row,
            headerIndexes: headerIndexes,
        )
        else { return nil }
        guard !value.isEmpty else { return nil }

        return value
    }

    private static func value(for header: HeaderField, row: [String], headerIndexes: [HeaderField: Int]) -> String? {
        guard let index = headerIndexes[header] else { return nil }
        guard row.indices.contains(index) else { return nil }

        return row[index].trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func parseDate(_ value: String) -> Date? {
        makeDateFormatter(withFractionalSeconds: true).date(from: value)
            ?? makeDateFormatter(withFractionalSeconds: false).date(from: value)
    }

    private static func isEmptyRow(_ row: [String]) -> Bool {
        row.allSatisfy(\.isEmpty)
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
