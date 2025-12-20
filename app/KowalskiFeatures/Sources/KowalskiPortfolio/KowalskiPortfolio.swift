//
//  KowalskiPortfolio.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import Observation
import KowalskiClient

@Observable
public final class KowalskiPortfolio {
    private let client: KowalskiClient
    private let mapper = KowalskiPortfolioMappers()

    private init(client: KowalskiClient) {
        self.client = client
    }

    @MainActor
    func storeTransaction(_ payload: TransactionPayload) async {
        let payload = mapper.mapTransactionPayloadToCreateEntryPayload(payload)
        _ = await client.portfolio.createEntry(payload: payload)
    }

    @MainActor
    func searchStocks(query: String) async -> Result<[Stock], Error> {
        let result = await client.stocks.search(query: query)
        return result.map(mapper.mapStocksSearchResponse)
            .mapError { error in error as Error }
    }

    // MARK: Factory

    public static func `default`() -> KowalskiPortfolio {
        let client = KowalskiClient.default()

        return KowalskiPortfolio(client: client)
    }

    public static func preview() -> KowalskiPortfolio {
        let client = KowalskiClient.preview(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }
}
