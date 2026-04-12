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

    private(set) var entries: [PortfolioEntry] = []
    private(set) var isLoading = false
    private(set) var netWorth: Double?
    private(set) var netWorthCurrency: Currencies?

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

        let fetchOverviewResult = await refreshOverview()
        switch fetchOverviewResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh portfolio overview after create", error: failure)
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

        let fetchOverviewResult = await refreshOverview()
        switch fetchOverviewResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh portfolio overview after update", error: failure)
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

    func fetchOverview() async -> Result<Void, Error> {
        await withLoading {
            let result = await client.portfolio.getOverview()
                .map(mapper.mapOverviewResponse)
            let overviewState: PortfolioOverviewState
            switch result {
            case let .failure(error): return .failure(error)
            case let .success(success):
                overviewState = success
            }

            let netWorth = computeNetWorth(for: overviewState.entries, currentValues: overviewState.currentValues)
            setEntries(overviewState.entries)
            setNetWorth(netWorth?.value)
            setNetWorthCurrency(netWorth?.currency)

            return .success(())
        }
    }

    private func computeNetWorth(for entries: [PortfolioEntry], currentValues: [String: Money]) -> Money? {
        let holdings = entries.reduce([String: Double]()) { holdings, entry in
            let amountDelta: Double = switch entry.transactionType {
            case .purchase: entry.amount
            case .sell: -entry.amount
            case .split: entry.amount
            }

            var holdings = holdings
            holdings[entry.stock.symbol, default: 0] += amountDelta

            return holdings
        }
        guard !holdings.isEmpty else { return Money(currency: .USD, value: 0) }

        let fallbackCurrency = currentValues.first?.value.currency ?? .USD
        var runningTotal = 0.0
        var netWorthCurrency: Currencies?
        for (symbol, quantity) in holdings {
            guard quantity != 0 else { continue }
            guard let currentValue = currentValues[symbol] else {
                logger.warning("Missing current value required for net worth calculation")
                return nil
            }
            if let netWorthCurrency, netWorthCurrency != currentValue.currency {
                logger.warning("Current stock values should use a consistent currency")
                return nil
            }
            if netWorthCurrency == nil {
                netWorthCurrency = currentValue.currency
            }

            runningTotal += quantity * currentValue.value
        }

        guard let netWorthCurrency else { return Money(currency: fallbackCurrency, value: 0) }

        return Money(currency: netWorthCurrency, value: runningTotal)
    }

    // MARK: Helpers

    @MainActor
    private func setEntries(_ newEntries: [PortfolioEntry]) {
        entries = newEntries
    }

    @MainActor
    private func setNetWorth(_ newNetWorth: Double?) {
        netWorth = newNetWorth
    }

    @MainActor
    private func setNetWorthCurrency(_ newNetWorthCurrency: Currencies?) {
        netWorthCurrency = newNetWorthCurrency
    }

    private func refreshOverview() async -> Result<Void, Error> {
        await fetchOverview()
    }

    @MainActor
    private func withLoading<T>(_ block: () async -> T) async -> T {
        isLoading = true
        let result = await block()
        isLoading = false

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
