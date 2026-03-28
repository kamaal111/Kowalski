//
//  KowalskiPortfolioClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import Foundation
import OpenAPIRuntime

// MARK: Protocol

public protocol KowalskiPortfolioClient: Sendable {
    func createEntry(
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientCreateEntryResponse, KowalskiPortfolioClientCreateEntryErrors>
}

// MARK: Factory

struct KowalskiPortfolioClientFactory {
    private init() {}

    static func `default`(client: Client) -> KowalskiPortfolioClient {
        KowalskiPortfolioClientImpl(client: client)
    }

    static func preview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientPreview()
    }
}

// MARK: Errors

public enum KowalskiPortfolioClientCreateEntryErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case badRequest
    case unauthorized
    case notFound
    case internalServerError
}

// MARK: Implementation

struct KowalskiPortfolioClientImpl: KowalskiPortfolioClient {
    private let client: Client
    private let mapper: KowalskiPortfolioMapper

    fileprivate init(client: Client) {
        self.client = client
        mapper = KowalskiPortfolioMapper()
    }

    func createEntry(
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientCreateEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        let apiPayload = mapper.mapCreateEntryPayloadToApi(payload)
        let response: Operations.PostAppApiPortfolioEntries.Output
        do {
            response = try await client.postAppApiPortfolioEntries(.init(body: .json(apiPayload)))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let createdResponse: Operations.PostAppApiPortfolioEntries.Output.Created
        switch response {
        case .badRequest:
            return .failure(.badRequest)
        case .unauthorized:
            return .failure(.unauthorized)
        case .notFound:
            return .failure(.notFound)
        case .internalServerError:
            return .failure(.internalServerError)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .created(created): createdResponse = created
        }
        let jsonResponse: Components.Schemas.CreateEntryResponse
        do {
            jsonResponse = try createdResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapCreateEntryApiResponseToClient(jsonResponse))
    }
}

// MARK: Preview

struct KowalskiPortfolioClientPreview: KowalskiPortfolioClient {
    func createEntry(
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientCreateEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        let stock = KowalskiClientStockItem(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchangeDispatch: "NASDAQ",
        )

        return .success(
            KowalskiPortfolioClientCreateEntryResponse(
                id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
                createdAt: Date(timeIntervalSince1970: 1_766_246_840),
                updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
                stock: stock,
                amount: 10,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
                transactionType: .buy,
                transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
            ),
        )
    }
}
