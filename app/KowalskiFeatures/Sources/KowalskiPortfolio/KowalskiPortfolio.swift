//
//  KowalskiPortfolio.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import Foundation
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
            case .badRequest:
                return .failure(.badRequest)
            case .internalServerError, .notFound, .unauthorized, .unknown:
                return .failure(.unknown)
            }
        case .success: break
        }

        let fetchEntriesResult = await fetchEntries()
        switch fetchEntriesResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh entries after create", error: failure)
        case .success: break
        }

        return .success(())
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

    // MARK: Helpers

    @MainActor
    private func setEntries(_ newEntries: [PortfolioEntry]) {
        entries = newEntries
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

        if KowalskiEnvironment.isUiTestingFailCreateEntry {
            return createEntryFailingPreview()
        }
        if KowalskiEnvironment.isUiTestingFailListEntries {
            return listEntriesFailingPreview()
        }
        if KowalskiEnvironment.isUiTestingListEntries {
            return listEntriesPreview()
        }

        return preview()
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

    private static func listEntriesPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioEntries(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    public static func listEntriesFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioListEntries(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }
}

// - MARK: Errors

enum StoreTransactionErrors: Error, LocalizedError {
    case unknown
    case badRequest

    var errorDescription: String? {
        switch self {
        case .unknown: NSLocalizedString("Failed to add transaction", comment: "")
        case .badRequest: NSLocalizedString("Invalid information provided", comment: "")
        }
    }
}
