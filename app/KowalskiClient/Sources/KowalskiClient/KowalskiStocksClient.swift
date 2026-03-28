//
//  KowalskiStocksClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

import OpenAPIRuntime

// MARK: Protocol

public protocol KowalskiStocksClient: Sendable {
    func search(query: String) async -> Result<KowalskiStocksSearchResponse, KowalskiStocksSearchErrors>
}

// MARK: Factory

struct KowalskiStocksClientFactory {
    private init() {}

    static func deafault(client: Client) -> KowalskiStocksClient {
        KowalskiStocksClientImpl(client: client)
    }

    static func preview() -> KowalskiStocksClient {
        KowalskiStocksClientPreview()
    }
}

// MARK: Errors

public enum KowalskiStocksSearchErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case notFound
}

// MARK: Implementation

struct KowalskiStocksClientImpl: KowalskiStocksClient {
    private let client: Client
    private let mapper: KowalskiStocksMapper

    init(client: Client) {
        self.client = client
        mapper = KowalskiStocksMapper()
    }

    // MARK: Search

    func search(query: String) async -> Result<KowalskiStocksSearchResponse, KowalskiStocksSearchErrors> {
        let response: Operations.GetAppApiStocksSearch.Output
        do {
            response = try await client.getAppApiStocksSearch(query: .init(q: query))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.GetAppApiStocksSearch.Output.Ok
        switch response {
        case .notFound, .badRequest:
            return .failure(.notFound)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            payload = ok
        }
        let jsonPayload: Components.Schemas.StocksSearchResponse
        do {
            jsonPayload = try payload.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapSearchResponse(jsonPayload))
    }
}

// MARK: Preview

struct KowalskiStocksClientPreview: KowalskiStocksClient {
    func search(query _: String) async -> Result<KowalskiStocksSearchResponse, KowalskiStocksSearchErrors> {
        let quotes = [
            KowalskiClientStockItem(
                symbol: "AAPL",
                exchange: "NMS",
                name: "Apple Inc.",
                sector: "Technology",
                industry: "Consumer Electronics",
                exchangeDispatch: "NASDAQ",
            ),
        ]
        let response = KowalskiStocksSearchResponse(quotes: quotes)

        return .success(response)
    }
}
