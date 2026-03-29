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
    func listEntries() async -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors>
    func createEntry(
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors>
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

    static func entriesPreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientEntriesPreview()
    }

    static func createEntryFailingPreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientCreateEntryFailingPreview()
    }

    static func listEntriesFailingPreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientListEntriesFailingPreview()
    }
}

// MARK: Errors

public enum KowalskiPortfolioClientCreateEntryErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case badRequest(errorCode: String?)
    case unauthorized
    case notFound
    case internalServerError
}

public enum KowalskiPortfolioClientListEntriesErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
}

// MARK: Implementation

struct KowalskiPortfolioClientImpl: KowalskiPortfolioClient {
    private let client: Client
    private let mapper: KowalskiPortfolioMapper

    fileprivate init(client: Client) {
        self.client = client
        mapper = KowalskiPortfolioMapper()
    }

    func listEntries() async -> Result<
        [KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors,
    > {
        let response: Operations.GetAppApiPortfolioEntries.Output
        do {
            response = try await client.getAppApiPortfolioEntries()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let okResponse: Operations.GetAppApiPortfolioEntries.Output.Ok
        switch response {
        case .unauthorized, .notFound:
            return .failure(.unauthorized)
        case .internalServerError:
            return .failure(.unknown(statusCode: 500, payload: nil, context: nil))
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            okResponse = ok
        }
        let jsonResponse: Components.Schemas.ListEntriesResponse
        do {
            jsonResponse = try okResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapListEntriesApiResponseToClient(jsonResponse))
    }

    func createEntry(
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        let apiPayload = mapper.mapCreateEntryPayloadToApi(payload)
        let response: Operations.PostAppApiPortfolioEntries.Output
        do {
            response = try await client.postAppApiPortfolioEntries(.init(body: .json(apiPayload)))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let createdResponse: Operations.PostAppApiPortfolioEntries.Output.Created
        switch response {
        case let .badRequest(payload):
            let body = try? payload.body.json
            return .failure(.badRequest(errorCode: body?.code))
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
    func listEntries() async -> Result<
        [KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors,
    > {
        .success([])
    }

    func createEntry(
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        .success(makePreviewEntry())
    }
}

struct KowalskiPortfolioClientEntriesPreview: KowalskiPortfolioClient {
    func listEntries() async -> Result<
        [KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors,
    > {
        .success([makePreviewEntry()])
    }

    func createEntry(
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        .success(makePreviewEntry())
    }
}

struct KowalskiPortfolioClientCreateEntryFailingPreview: KowalskiPortfolioClient {
    func listEntries() async -> Result<
        [KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors,
    > {
        .success([])
    }

    func createEntry(
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        .failure(.internalServerError)
    }
}

struct KowalskiPortfolioClientListEntriesFailingPreview: KowalskiPortfolioClient {
    func listEntries() async -> Result<
        [KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors,
    > {
        .failure(.unknown(statusCode: 500, payload: nil, context: nil))
    }

    func createEntry(
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        .success(makePreviewEntry())
    }
}

private func makePreviewEntry() -> KowalskiPortfolioClientEntryResponse {
    let stock = KowalskiClientStockItem(
        symbol: "AAPL",
        exchange: "NMS",
        name: "Apple Inc.",
        sector: "Technology",
        industry: "Consumer Electronics",
        exchangeDispatch: "NASDAQ",
    )

    return KowalskiPortfolioClientEntryResponse(
        id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
        stock: stock,
        amount: 10,
        purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
        transactionType: .buy,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}
