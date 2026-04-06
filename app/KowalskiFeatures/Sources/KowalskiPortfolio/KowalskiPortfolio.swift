//
//  KowalskiPortfolio.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import ForexKit
import Foundation
import KamaalExtensions
import KamaalLogger
import KowalskiClient
import KowalskiUtils
import Observation

private let logger = KamaalLogger(from: KowalskiPortfolio.self, failOnError: true)

@Observable
@MainActor
public final class KowalskiPortfolio {
    private let client: KowalskiClient
    private let mapper = KowalskiPortfolioMappers()
    private var lastPreferredCurrency: Currencies?

    private(set) var entries: [PortfolioEntry] = []
    private(set) var isLoading = false
    private(set) var netWorth: Double?
    private(set) var isLoadingNetWorth = false

    private init(client: KowalskiClient) {
        self.client = client
    }

    @MainActor
    func storeTransaction(_ payload: TransactionPayload) async -> Result<Void, StoreTransactionErrors> {
        let payload = mapper.mapTransactionPayloadToCreateEntryPayload(payload)
        let createEntryResult = await client.portfolio.createEntry(payload: payload)
        switch createEntryResult {
        case let .failure(failure):
            switch failure {
            case let .badRequest(_, validations):
                return .failure(.badRequest(validations: validations))
            case .internalServerError, .notFound, .unauthorized, .unknown:
                return .failure(.unknown)
            }
        case .success: break
        }

        let fetchEntriesResult = await refreshEntries()
        switch fetchEntriesResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh entries after create", error: failure)
        case .success: break
        }

        return .success(())
    }

    func updateTransaction(
        _ payload: TransactionPayload,
        entryId: String,
    ) async -> Result<PortfolioEntry, UpdateTransactionErrors> {
        let payload = mapper.mapTransactionPayloadToCreateEntryPayload(payload)
        let updateEntryResult = await client.portfolio.updateEntry(entryId: entryId, payload: payload)
        switch updateEntryResult {
        case let .failure(failure):
            switch failure {
            case let .badRequest(_, validations):
                return .failure(.badRequest(validations: validations))
            case .internalServerError, .notFound, .unauthorized, .unknown:
                return .failure(.unknown)
            }
        case .success: break
        }

        let fetchEntriesResult = await refreshEntries()
        switch fetchEntriesResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh entries after update", error: failure)
        case .success:
            guard let updatedEntry = entries.find(by: \.id, is: entryId) else {
                logger.error("Updated entry missing from refreshed entries")
                return .failure(.unknown)
            }

            return .success(updatedEntry)
        }

        return .failure(.unknown)
    }

    @MainActor
    func searchStocks(query: String) async -> Result<[Stock], Error> {
        let result = await client.stocks.search(query: query)

        return result.map(mapper.mapStocksSearchResponse)
            .mapError { error in error as Error }
    }

    func fetchEntries() async -> Result<Void, Error> {
        await withLoading {
            let result = await client.portfolio.listEntries()
            switch result {
            case let .failure(error): return .failure(error)
            case let .success(entries):
                setEntries(mapper.mapPortfolioEntries(entries))
            }

            return .success(())
        }
    }

    func fetchNetWorth(preferredCurrency: Currencies) async {
        let preferredCurrencyDidChange =
            lastPreferredCurrency != nil && lastPreferredCurrency != preferredCurrency && !entries.isEmpty
        setLastPreferredCurrency(preferredCurrency)

        if preferredCurrencyDidChange {
            let refreshEntriesResult = await fetchEntries()
            switch refreshEntriesResult {
            case let .failure(failure):
                logger.error(label: "Failed to refresh entries after preferred currency changed", error: failure)
                setNetWorth(nil)
                return
            case .success:
                break
            }
        }

        await withLoadingNetWorth {
            let valuedEntries = entries.filter { $0.transactionType != .split }
            guard !valuedEntries.isEmpty else {
                setNetWorth(0)
                return
            }

            guard let netWorth = computeNetWorth(for: valuedEntries, in: preferredCurrency) else {
                logger.warning("Failed to compute net worth from preferred-currency entry values")
                setNetWorth(nil)
                return
            }

            setNetWorth(netWorth)
        }
    }

    private func computeNetWorth(
        for entries: [PortfolioEntry],
        in preferredCurrency: Currencies,
    ) -> Double? {
        var runningTotal = 0.0
        for entry in entries {
            guard let preferredCurrencyPurchasePrice = entry.preferredCurrencyPurchasePrice else {
                logger.warning("Missing preferred-currency purchase price required for net worth calculation")
                return nil
            }
            guard preferredCurrencyPurchasePrice.currency == preferredCurrency else {
                logger.warning("Preferred-currency purchase price should match the requested preferred currency")
                return nil
            }

            let signedAmount: Double = switch entry.transactionType {
            case .purchase:
                entry.amount * preferredCurrencyPurchasePrice.value
            case .sell:
                -(entry.amount * preferredCurrencyPurchasePrice.value)
            case .split:
                0
            }

            runningTotal += signedAmount
        }

        return runningTotal
    }

    // MARK: Helpers

    @MainActor
    private func setLastPreferredCurrency(_ preferredCurrency: Currencies) {
        lastPreferredCurrency = preferredCurrency
    }

    @MainActor
    private func setEntries(_ newEntries: [PortfolioEntry]) {
        entries = newEntries
    }

    @MainActor
    private func setNetWorth(_ newNetWorth: Double?) {
        netWorth = newNetWorth
    }

    private func refreshEntries() async -> Result<Void, Error> {
        let result = await fetchEntries()
        guard case .success = result else { return result }
        if let lastPreferredCurrency {
            await fetchNetWorth(preferredCurrency: lastPreferredCurrency)
        }

        return result
    }

    @MainActor
    private func withLoading<T>(_ block: () async -> T) async -> T {
        isLoading = true
        let result = await block()
        isLoading = false

        return result
    }

    @MainActor
    private func withLoadingNetWorth<T>(_ block: () async -> T) async -> T {
        isLoadingNetWorth = true
        let result = await block()
        isLoadingNetWorth = false

        return result
    }

    // MARK: Factory

    public static func forEnvironment() -> KowalskiPortfolio {
        guard KowalskiEnvironment.isUiTesting else { return `default`() }
        guard let scenario = KowalskiEnvironment.portfolioUiTestScenario else { return preview() }

        switch scenario {
        case .entries:
            return listEntriesPreview()
        case .createSequence:
            return createEntrySequencePreview()
        case .listFailure:
            return listEntriesFailingPreview()
        }
    }

    public static func `default`() -> KowalskiPortfolio {
        let client = KowalskiClient.default()

        return KowalskiPortfolio(client: client)
    }

    public static func preview() -> KowalskiPortfolio {
        let client = KowalskiClient.preview(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    public static func createEntryFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioCreateEntry(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    public static func createEntryValidationFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithValidationFailingPortfolioCreateEntry(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    private static func createEntrySequencePreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioCreateSequence(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    private static func listEntriesPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioEntries(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    public static func listEntriesFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioListEntries(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    static func testing(client: KowalskiClient) -> KowalskiPortfolio {
        KowalskiPortfolio(client: client)
    }
}

// - MARK: Errors

enum StoreTransactionErrors: Error, Equatable, LocalizedError {
    case unknown
    case badRequest(validations: [KowalskiClientValidationIssue])

    var errorDescription: String? {
        switch self {
        case .unknown: NSLocalizedString("Failed to add transaction", comment: "")
        case let .badRequest(validations):
            validationErrorMessage(
                validations,
                fallback: NSLocalizedString("Invalid information provided", comment: ""),
            )
        }
    }
}

enum UpdateTransactionErrors: Error, Equatable, LocalizedError {
    case unknown
    case badRequest(validations: [KowalskiClientValidationIssue])

    var errorDescription: String? {
        switch self {
        case .unknown: NSLocalizedString("Failed to update transaction", comment: "")
        case let .badRequest(validations):
            validationErrorMessage(
                validations,
                fallback: NSLocalizedString("Invalid information provided", comment: ""),
            )
        }
    }
}

private func validationErrorMessage(_ validations: [KowalskiClientValidationIssue], fallback: String) -> String {
    guard let firstValidation = validations.first else { return fallback }
    guard let field = firstValidation.displayPath else { return fallback }

    return "\(field): \(firstValidation.message)"
}
