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
typealias ExchangeRatesFetcher = @Sendable (Currencies, [Currencies]) async -> ExchangeRates?

@Observable
@MainActor
public final class KowalskiPortfolio {
    private let client: KowalskiClient
    private let forexKitConfiguration: ForexKitConfiguration
    private let exchangeRatesFetcher: ExchangeRatesFetcher?
    private let mapper = KowalskiPortfolioMappers()
    private var lastPreferredCurrency: Currencies?

    private(set) var entries: [PortfolioEntry] = []
    private(set) var isLoading = false
    private(set) var netWorth: Double?
    private(set) var isLoadingNetWorth = false

    private init(
        client: KowalskiClient,
        forexKitConfiguration: ForexKitConfiguration,
        exchangeRatesFetcher: ExchangeRatesFetcher? = nil,
    ) {
        self.client = client
        self.forexKitConfiguration = forexKitConfiguration
        self.exchangeRatesFetcher = exchangeRatesFetcher
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
        setLastPreferredCurrency(preferredCurrency)

        await withLoadingNetWorth {
            let valuedEntries = entries.filter { $0.transactionType != .split }
            guard !valuedEntries.isEmpty else {
                setNetWorth(0)
                return
            }

            let sourceCurrencies = valuedEntries
                .map(\.purchasePrice.currency)
                .filter { $0 != preferredCurrency }
                .uniques()
                .sorted { $0.rawValue < $1.rawValue }
            let exchangeRates: ExchangeRates? = if sourceCurrencies.isEmpty {
                ExchangeRates(base: preferredCurrency, date: .now, rates: [:])
            } else if let exchangeRatesFetcher {
                await exchangeRatesFetcher(preferredCurrency, sourceCurrencies)
            } else {
                await fetchLatestExchangeRates(
                    preferredCurrency: preferredCurrency,
                    sourceCurrencies: sourceCurrencies,
                )
            }

            guard let exchangeRates else {
                logger.warning("No exchange rates available for net worth calculation")
                setNetWorth(nil)
                return
            }

            guard let netWorth = computeNetWorth(for: valuedEntries, in: preferredCurrency, using: exchangeRates) else {
                logger.warning("Failed to compute net worth from exchange rates")
                setNetWorth(nil)
                return
            }

            setNetWorth(netWorth)
        }
    }

    private func computeNetWorth(
        for entries: [PortfolioEntry],
        in preferredCurrency: Currencies,
        using exchangeRates: ExchangeRates,
    ) -> Double? {
        guard exchangeRates.baseCurrency == preferredCurrency else {
            logger.warning("Exchange rate base currency should match the preferred currency for net worth calculation")
            return nil
        }

        var runningTotal = 0.0
        for entry in entries {
            let signedAmount: Double = switch entry.transactionType {
            case .purchase:
                entry.amount * entry.purchasePrice.value
            case .sell:
                -(entry.amount * entry.purchasePrice.value)
            case .split:
                0
            }

            if entry.purchasePrice.currency == preferredCurrency || signedAmount == 0 {
                runningTotal += signedAmount
                continue
            }

            guard let rate = exchangeRates.ratesMappedByCurrency[entry.purchasePrice.currency] else {
                logger.warning("Missing exchange rate required for net worth calculation")
                return nil
            }

            runningTotal += signedAmount / rate
        }

        return runningTotal
    }

    // MARK: Helpers

    @MainActor
    private func setLastPreferredCurrency(_ preferredCurrency: Currencies) {
        lastPreferredCurrency = preferredCurrency
    }

    private func fetchLatestExchangeRates(
        preferredCurrency: Currencies,
        sourceCurrencies: [Currencies],
    ) async -> ExchangeRates? {
        let forexKit = ForexKit(configuration: forexKitConfiguration)
        let requestPath = Self.forexLatestRequestPath(base: preferredCurrency, symbols: sourceCurrencies)

        logger.debug("Request: GET \(requestPath) body: <nil>")

        let latestRatesResult = await forexKit.getLatest(base: preferredCurrency, symbols: sourceCurrencies)
        switch latestRatesResult {
        case let .failure(failure):
            logger.warning("Request failed. Error: \(failure.localizedDescription)")
            logger.error(label: "Failed to fetch exchange rates for net worth", error: failure)

            return await fetchFallbackExchangeRates(
                preferredCurrency: preferredCurrency,
                sourceCurrencies: sourceCurrencies,
                requestPath: requestPath,
            )
        case let .success(success):
            guard let success else {
                logger.debug("Response: GET \(requestPath) 200 body: <nil>")

                return await fetchFallbackExchangeRates(
                    preferredCurrency: preferredCurrency,
                    sourceCurrencies: sourceCurrencies,
                    requestPath: requestPath,
                )
            }

            logger.debug("Response: GET \(requestPath) 200 body: \(Self.forexLatestResponseBody(success))")
            return success
        }
    }

    private func fetchFallbackExchangeRates(
        preferredCurrency: Currencies,
        sourceCurrencies: [Currencies],
        requestPath: String,
    ) async -> ExchangeRates? {
        let forexKit = ForexKit(configuration: forexKitConfiguration)
        let fallbackRates = await forexKit.getFallback(base: preferredCurrency, symbols: sourceCurrencies)
        guard let fallbackRates else {
            logger.warning("Response: GET \(requestPath) fallback body: <nil>")
            return nil
        }

        logger.debug("Response: GET \(requestPath) fallback body: \(Self.forexLatestResponseBody(fallbackRates))")
        return fallbackRates
    }

    static func forexLatestRequestPath(base: Currencies, symbols: [Currencies]) -> String {
        let latestPath = KowalskiServerConfiguration.forexBaseURL()
            .appendingPathComponent("latest")
            .path
        let symbolsValue = symbols
            .map(\.rawValue)
            .sorted()
            .joined(separator: ",")

        return "\(latestPath)?base=\(base.rawValue)&symbols=\(symbolsValue)"
    }

    static func forexLatestResponseBody(_ exchangeRates: ExchangeRates) -> String {
        let rateCount = exchangeRates.ratesMappedByCurrency.count
        let currencies = exchangeRates.ratesMappedByCurrency.keys
            .map(\.rawValue)
            .sorted()
            .joined(separator: ",")

        return "{base: \(exchangeRates.base), rateCount: \(rateCount), currencies: [\(currencies)]}"
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
        let forexKitConfiguration = KowalskiServerConfiguration.defaultForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    public static func preview() -> KowalskiPortfolio {
        let client = KowalskiClient.preview(withCredentials: true)
        let forexKitConfiguration = previewForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    public static func createEntryFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioCreateEntry(withCredentials: true)
        let forexKitConfiguration = previewForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    public static func createEntryValidationFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithValidationFailingPortfolioCreateEntry(withCredentials: true)
        let forexKitConfiguration = previewForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    private static func createEntrySequencePreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioCreateSequence(withCredentials: true)
        let forexKitConfiguration = previewForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    private static func listEntriesPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioEntries(withCredentials: true)
        let forexKitConfiguration = previewForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    public static func listEntriesFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioListEntries(withCredentials: true)
        let forexKitConfiguration = previewForexKitConfiguration()

        return KowalskiPortfolio(client: client, forexKitConfiguration: forexKitConfiguration)
    }

    static func testing(
        client: KowalskiClient,
        forexKitConfiguration: ForexKitConfiguration = previewForexKitConfiguration(),
        exchangeRatesFetcher: ExchangeRatesFetcher? = nil,
    ) -> KowalskiPortfolio {
        KowalskiPortfolio(
            client: client,
            forexKitConfiguration: forexKitConfiguration,
            exchangeRatesFetcher: exchangeRatesFetcher,
        )
    }

    private static func previewForexKitConfiguration() -> ForexKitConfiguration {
        ForexKitConfiguration(preview: true, skipCaching: true)
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
