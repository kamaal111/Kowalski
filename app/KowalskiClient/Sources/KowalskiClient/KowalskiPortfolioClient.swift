//
//  KowalskiPortfolioClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import Foundation
import KamaalExtensions
import OpenAPIRuntime

// MARK: Protocol

public protocol KowalskiPortfolioClient: Sendable {
    func getDashboards(
        period: KowalskiPortfolioDashboardPeriod,
    ) async -> Result<KowalskiPortfolioDashboardsResponse, KowalskiPortfolioClientDashboardsErrors>
    func getOverview() async -> Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors>
    func getOverviewPreflight() async -> Result<
        KowalskiPortfolioOverviewPreflightResponse,
        KowalskiPortfolioClientOverviewPreflightErrors,
    >
    func bulkCreateEntries(
        entries: [KowalskiPortfolioBulkCreateEntryItemPayload],
    ) async -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientBulkCreateEntriesErrors>
    func createEntry(
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors>
    func updateEntry(
        entryId: String,
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientUpdateEntryErrors>
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
        KowalskiPortfolioClientPreview(entries: makePreviewEntries())
    }

    static func createSequencePreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientPreview(
            entries: makePreviewEntries(),
            createResults: [
                .success,
                .failure(.internalServerError),
                .failure(.badRequest(
                    errorCode: "INVALID_PAYLOAD",
                    validations: [makePreviewValidationIssue()],
                )),
            ],
        )
    }

    static func createEntryFailingPreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientPreview(createResults: [.failure(.internalServerError)])
    }

    static func createEntryValidationFailingPreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientPreview(
            createResults: [
                .failure(.badRequest(
                    errorCode: "INVALID_PAYLOAD",
                    validations: [makePreviewValidationIssue()],
                )),
            ],
        )
    }

    static func overviewFailingPreview() -> KowalskiPortfolioClient {
        KowalskiPortfolioClientPreview(overviewFailure: .unknown(statusCode: 500, payload: nil, context: nil))
    }
}

// MARK: Errors

public enum KowalskiPortfolioClientCreateEntryErrors: Error, Equatable {
    public static func == (
        lhs: KowalskiPortfolioClientCreateEntryErrors,
        rhs: KowalskiPortfolioClientCreateEntryErrors,
    ) -> Bool {
        switch lhs {
        case let .unknown(lhsStatusCode, lhsPayload, lhsContext):
            if case let .unknown(rhsStatusCode, rhsPayload, rhsContext) = rhs {
                return lhsStatusCode == rhsStatusCode &&
                    lhsPayload == rhsPayload &&
                    lhsContext?.localizedDescription == rhsContext?.localizedDescription
            }
        case let .badRequest(lhsErrorCode, lhsValidations):
            if case let .badRequest(rhsErrorCode, rhsValidations) = rhs {
                return lhsErrorCode == rhsErrorCode && lhsValidations == rhsValidations
            }
        case .unauthorized:
            if case .unauthorized = rhs {
                return true
            }
        case .notFound:
            if case .notFound = rhs {
                return true
            }
        case .internalServerError:
            if case .internalServerError = rhs {
                return true
            }
        }

        return false
    }

    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case badRequest(errorCode: String?, validations: [KowalskiClientValidationIssue])
    case unauthorized
    case notFound
    case internalServerError
}

public enum KowalskiPortfolioClientBulkCreateEntriesErrors: Error, Equatable {
    public static func == (
        lhs: KowalskiPortfolioClientBulkCreateEntriesErrors,
        rhs: KowalskiPortfolioClientBulkCreateEntriesErrors,
    ) -> Bool {
        switch lhs {
        case let .unknown(lhsStatusCode, lhsPayload, lhsContext):
            if case let .unknown(rhsStatusCode, rhsPayload, rhsContext) = rhs {
                return lhsStatusCode == rhsStatusCode &&
                    lhsPayload == rhsPayload &&
                    lhsContext?.localizedDescription == rhsContext?.localizedDescription
            }
        case .unauthorized:
            if case .unauthorized = rhs {
                return true
            }
        case .notFound:
            if case .notFound = rhs {
                return true
            }
        case .internalServerError:
            if case .internalServerError = rhs {
                return true
            }
        }

        return false
    }

    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
    case notFound
    case internalServerError
}

public enum KowalskiPortfolioClientUpdateEntryErrors: Error, Equatable {
    public static func == (
        lhs: KowalskiPortfolioClientUpdateEntryErrors,
        rhs: KowalskiPortfolioClientUpdateEntryErrors,
    ) -> Bool {
        switch lhs {
        case let .unknown(lhsStatusCode, lhsPayload, lhsContext):
            if case let .unknown(rhsStatusCode, rhsPayload, rhsContext) = rhs {
                return lhsStatusCode == rhsStatusCode &&
                    lhsPayload == rhsPayload &&
                    lhsContext?.localizedDescription == rhsContext?.localizedDescription
            }
        case let .badRequest(lhsErrorCode, lhsValidations):
            if case let .badRequest(rhsErrorCode, rhsValidations) = rhs {
                return lhsErrorCode == rhsErrorCode && lhsValidations == rhsValidations
            }
        case .unauthorized:
            if case .unauthorized = rhs {
                return true
            }
        case .notFound:
            if case .notFound = rhs {
                return true
            }
        case .internalServerError:
            if case .internalServerError = rhs {
                return true
            }
        }

        return false
    }

    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case badRequest(errorCode: String?, validations: [KowalskiClientValidationIssue])
    case unauthorized
    case notFound
    case internalServerError
}

public enum KowalskiPortfolioClientOverviewErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
}

public enum KowalskiPortfolioClientDashboardsErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
}

public enum KowalskiPortfolioClientOverviewPreflightErrors: Error, Equatable {
    public static func == (
        lhs: KowalskiPortfolioClientOverviewPreflightErrors,
        rhs: KowalskiPortfolioClientOverviewPreflightErrors,
    ) -> Bool {
        switch lhs {
        case let .unknown(lhsStatusCode, lhsPayload, lhsContext):
            if case let .unknown(rhsStatusCode, rhsPayload, rhsContext) = rhs {
                return lhsStatusCode == rhsStatusCode &&
                    lhsPayload == rhsPayload &&
                    lhsContext?.localizedDescription == rhsContext?.localizedDescription
            }
        case .unauthorized:
            if case .unauthorized = rhs {
                return true
            }
        }

        return false
    }

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

    func getDashboards(
        period: KowalskiPortfolioDashboardPeriod,
    ) async -> Result<KowalskiPortfolioDashboardsResponse, KowalskiPortfolioClientDashboardsErrors> {
        let response: Operations.GetAppApiPortfolioDashboards.Output
        do {
            response = try await client.getAppApiPortfolioDashboards(query: .init(period: period.apiValue))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let okResponse: Operations.GetAppApiPortfolioDashboards.Output.Ok
        switch response {
        case .badRequest:
            return .failure(.unknown(statusCode: 400, payload: nil, context: nil))
        case .unauthorized, .notFound:
            return .failure(.unauthorized)
        case .internalServerError:
            return .failure(.unknown(statusCode: 500, payload: nil, context: nil))
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            okResponse = ok
        }
        let jsonResponse: Components.Schemas.PortfolioDashboardsResponse
        do {
            jsonResponse = try okResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapDashboardsApiResponseToClient(jsonResponse))
    }

    func getOverview() async -> Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors> {
        let response: Operations.GetAppApiPortfolioOverview.Output
        do {
            response = try await client.getAppApiPortfolioOverview()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let okResponse: Operations.GetAppApiPortfolioOverview.Output.Ok
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
        let jsonResponse: Components.Schemas.PortfolioOverviewResponse
        do {
            jsonResponse = try okResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapOverviewApiResponseToClient(jsonResponse))
    }

    func getOverviewPreflight() async -> Result<
        KowalskiPortfolioOverviewPreflightResponse,
        KowalskiPortfolioClientOverviewPreflightErrors,
    > {
        let response: Operations.GetAppApiPortfolioOverviewPreflight.Output
        do {
            response = try await client.getAppApiPortfolioOverviewPreflight()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let okResponse: Operations.GetAppApiPortfolioOverviewPreflight.Output.Ok
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
        let jsonResponse: Components.Schemas.PortfolioOverviewPreflightResponse
        do {
            jsonResponse = try okResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapOverviewPreflightApiResponseToClient(jsonResponse))
    }

    func bulkCreateEntries(
        entries: [KowalskiPortfolioBulkCreateEntryItemPayload],
    ) async -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientBulkCreateEntriesErrors> {
        let apiPayload = Components.Schemas.BulkCreateEntriesPayload(
            entries: entries.map(mapper.mapBulkCreateEntryItemPayloadToApi),
        )
        let response: Operations.PostAppApiPortfolioEntriesBulk.Output
        do {
            response = try await client.postAppApiPortfolioEntriesBulk(.init(body: .json(apiPayload)))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let createdResponse: Operations.PostAppApiPortfolioEntriesBulk.Output.Created
        switch response {
        case .unauthorized:
            return .failure(.unauthorized)
        case .notFound:
            return .failure(.notFound)
        case .internalServerError:
            return .failure(.internalServerError)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .created(created):
            createdResponse = created
        case .badRequest:
            return .failure(.unknown(statusCode: 400, payload: nil, context: nil))
        }
        let jsonResponse: Components.Schemas.BulkCreateEntriesResponse
        do {
            jsonResponse = try createdResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapBulkCreateEntriesApiResponseToClient(jsonResponse))
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
            let validations = KowalskiClientValidationErrorParser.parseIssues(from: body)

            return .failure(.badRequest(errorCode: body?.code, validations: validations))
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

    func updateEntry(
        entryId: String,
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientUpdateEntryErrors> {
        let apiPayload = mapper.mapCreateEntryPayloadToApi(payload)
        let response: Operations.PutAppApiPortfolioEntriesEntryId.Output
        do {
            response = try await client.putAppApiPortfolioEntriesEntryId(
                path: .init(entryId: entryId),
                body: .json(apiPayload),
            )
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let okResponse: Operations.PutAppApiPortfolioEntriesEntryId.Output.Ok
        switch response {
        case let .badRequest(payload):
            let body = try? payload.body.json
            let validations = KowalskiClientValidationErrorParser.parseIssues(from: body)

            return .failure(.badRequest(errorCode: body?.code, validations: validations))
        case .unauthorized:
            return .failure(.unauthorized)
        case .notFound:
            return .failure(.notFound)
        case .internalServerError:
            return .failure(.internalServerError)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            okResponse = ok
        }
        let jsonResponse: Components.Schemas.CreateEntryResponse
        do {
            jsonResponse = try okResponse.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapCreateEntryApiResponseToClient(jsonResponse))
    }
}

private extension KowalskiPortfolioDashboardPeriod {
    var apiValue: Components.Schemas.PortfolioDashboardPeriod {
        switch self {
        case .oneWeek: ._1w
        case .oneMonth: ._1m
        case .threeMonths: ._3m
        case .sixMonths: ._6m
        case .yearToDate: .ytd
        case .oneYear: ._1y
        case .twoYears: ._2y
        case .fiveYears: ._5y
        case .tenYears: ._10y
        case .all: .all
        }
    }
}

// MARK: Preview

actor KowalskiPortfolioClientPreview: KowalskiPortfolioClient {
    private var entries: [KowalskiPortfolioClientEntryResponse]
    private var createResults: [PortfolioClientPreviewCreateResult]
    private let updateFailure: KowalskiPortfolioClientUpdateEntryErrors?
    private let overviewFailure: KowalskiPortfolioClientOverviewErrors?
    private var preflightResults: [Result<
        KowalskiPortfolioOverviewPreflightResponse,
        KowalskiPortfolioClientOverviewPreflightErrors,
    >]
    private var overviewCurrentValues: [String: KowalskiClientMoney]

    fileprivate init(
        entries: [KowalskiPortfolioClientEntryResponse] = [],
        createResults: [PortfolioClientPreviewCreateResult] = [],
        updateFailure: KowalskiPortfolioClientUpdateEntryErrors? = nil,
        overviewFailure: KowalskiPortfolioClientOverviewErrors? = nil,
        preflightResults: [Result<
            KowalskiPortfolioOverviewPreflightResponse,
            KowalskiPortfolioClientOverviewPreflightErrors,
        >] = [],
        overviewCurrentValues: [String: KowalskiClientMoney] = makePreviewCurrentValues(),
    ) {
        self.entries = entries
        self.createResults = createResults
        self.updateFailure = updateFailure
        self.overviewFailure = overviewFailure
        self.preflightResults = preflightResults
        self.overviewCurrentValues = overviewCurrentValues
    }

    func getDashboards(
        period _: KowalskiPortfolioDashboardPeriod,
    ) async -> Result<KowalskiPortfolioDashboardsResponse, KowalskiPortfolioClientDashboardsErrors> {
        .success(makePreviewDashboards())
    }

    func getOverview() async -> Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors> {
        if let overviewFailure {
            return .failure(overviewFailure)
        }

        return .success(
            KowalskiPortfolioOverviewResponse(
                transactions: sortedEntries(),
                currentValues: overviewCurrentValues,
                holdings: makePreviewHoldings(entries: sortedEntries(), currentValues: overviewCurrentValues),
                netWorth: makePreviewNetWorth(entries: sortedEntries(), currentValues: overviewCurrentValues),
            ),
        )
    }

    func getOverviewPreflight() async -> Result<
        KowalskiPortfolioOverviewPreflightResponse,
        KowalskiPortfolioClientOverviewPreflightErrors,
    > {
        guard !preflightResults.isEmpty else {
            return .success(
                KowalskiPortfolioOverviewPreflightResponse(
                    refreshState: .ready,
                    pollAfterMilliseconds: nil,
                    latestCachedPriceDate: nil,
                ),
            )
        }

        return preflightResults.removeFirst()
    }

    func bulkCreateEntries(
        entries: [KowalskiPortfolioBulkCreateEntryItemPayload],
    ) async -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientBulkCreateEntriesErrors> {
        let createdEntries = entries.map { entry in
            let previewEntry = makePreviewEntry(
                payload: KowalskiPortfolioCreateEntryPayload(
                    stock: entry.stock,
                    amount: entry.amount,
                    purchasePrice: entry.purchasePrice,
                    transactionType: entry.transactionType,
                    transactionDate: entry.transactionDate,
                ),
                entryId: entry.id ?? UUID().uuidString,
                createdAt: .now,
                updatedAt: .now,
            )
            overviewCurrentValues[entry.stock.symbol] = entry.purchasePrice

            return previewEntry
        }
        self.entries.append(contentsOf: createdEntries)

        return .success(createdEntries)
    }

    func createEntry(
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        if !createResults.isEmpty {
            let createResult = createResults.removeFirst()
            switch createResult {
            case let .failure(failure):
                return .failure(failure)
            case .success:
                break
            }
        }

        let entry = makePreviewEntry(
            payload: payload,
            entryId: UUID().uuidString,
            createdAt: .now,
            updatedAt: .now,
        )
        entries.append(entry)
        overviewCurrentValues[payload.stock.symbol] = payload.purchasePrice

        return .success(entry)
    }

    func updateEntry(
        entryId: String,
        payload: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientUpdateEntryErrors> {
        if let updateFailure {
            return .failure(updateFailure)
        }

        guard let index = entries.findIndex(by: \.id, is: entryId) else { return .failure(.notFound) }

        let existingEntry = entries[index]
        let updatedEntry = makePreviewEntry(
            payload: payload,
            entryId: existingEntry.id,
            createdAt: existingEntry.createdAt,
            updatedAt: .now,
        )
        entries[index] = updatedEntry
        overviewCurrentValues[payload.stock.symbol] = payload.purchasePrice

        return .success(updatedEntry)
    }

    private func sortedEntries() -> [KowalskiPortfolioClientEntryResponse] {
        entries.sorted {
            if $0.transactionDate == $1.transactionDate {
                return $0.updatedAt > $1.updatedAt
            }

            return $0.transactionDate > $1.transactionDate
        }
    }
}

private enum PortfolioClientPreviewCreateResult {
    case success
    case failure(KowalskiPortfolioClientCreateEntryErrors)
}

private func makePreviewEntries() -> [KowalskiPortfolioClientEntryResponse] {
    [
        makePreviewEntry(),
        makePreviewEntry(
            payload: makePreviewCreatePayload(
                stock: KowalskiClientStockItem(
                    symbol: "TSLA",
                    exchange: "NMS",
                    name: "Tesla, Inc.",
                    isin: "US88160R1014",
                    sector: "Consumer Cyclical",
                    industry: "Auto Manufacturers",
                    exchangeDispatch: "NASDAQ",
                ),
                amount: 7,
                purchasePrice: KowalskiClientMoney(currency: .USD, value: 210),
                transactionType: .sell,
                transactionDate: Date(timeIntervalSince1970: 1_766_160_440),
            ),
            entryId: UUID(uuidString: "d0db73d8-2794-4141-bf4b-d9f332298b5f")!.uuidString,
            createdAt: Date(timeIntervalSince1970: 1_766_160_440),
            updatedAt: Date(timeIntervalSince1970: 1_766_160_440),
        ),
        makePreviewEntry(
            payload: makePreviewCreatePayload(
                stock: KowalskiClientStockItem(
                    symbol: "NVDA",
                    exchange: "NMS",
                    name: "NVIDIA Corporation",
                    isin: "US67066G1040",
                    sector: "Technology",
                    industry: "Semiconductors",
                    exchangeDispatch: "NASDAQ",
                ),
                amount: 4,
                purchasePrice: KowalskiClientMoney(currency: .USD, value: 120),
                transactionType: .split,
                transactionDate: Date(timeIntervalSince1970: 1_766_074_040),
            ),
            entryId: UUID(uuidString: "853459e7-7640-40a0-a2a5-e799af704503")!.uuidString,
            createdAt: Date(timeIntervalSince1970: 1_766_074_040),
            updatedAt: Date(timeIntervalSince1970: 1_766_074_040),
        ),
    ]
}

private func makePreviewEntry() -> KowalskiPortfolioClientEntryResponse {
    makePreviewEntry(
        payload: makePreviewCreatePayload(),
        entryId: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makePreviewEntry(
    payload: KowalskiPortfolioCreateEntryPayload,
    entryId: String,
    createdAt: Date,
    updatedAt: Date,
) -> KowalskiPortfolioClientEntryResponse {
    KowalskiPortfolioClientEntryResponse(
        id: entryId,
        createdAt: createdAt,
        updatedAt: updatedAt,
        stock: payload.stock,
        amount: payload.amount,
        purchasePrice: payload.purchasePrice,
        preferredCurrencyPurchasePrice: payload.purchasePrice,
        transactionType: payload.transactionType,
        transactionDate: payload.transactionDate,
    )
}

private func makePreviewCreatePayload() -> KowalskiPortfolioCreateEntryPayload {
    makePreviewCreatePayload(
        stock: KowalskiClientStockItem(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            isin: "US0378331005",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchangeDispatch: "NASDAQ",
        ),
        amount: 10,
        purchasePrice: KowalskiClientMoney(currency: .USD, value: 150.5),
        transactionType: .buy,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makePreviewCreatePayload(
    stock: KowalskiClientStockItem,
    amount: Double,
    purchasePrice: KowalskiClientMoney,
    transactionType: KowalskiClientPortfolioTransactionTypes,
    transactionDate: Date,
) -> KowalskiPortfolioCreateEntryPayload {
    KowalskiPortfolioCreateEntryPayload(
        stock: stock,
        amount: amount,
        purchasePrice: purchasePrice,
        transactionType: transactionType,
        transactionDate: transactionDate,
    )
}

private func makePreviewCurrentValues() -> [String: KowalskiClientMoney] {
    [
        "AAPL": KowalskiClientMoney(currency: .USD, value: 185.45),
        "TSLA": KowalskiClientMoney(currency: .USD, value: 420.5),
        "NVDA": KowalskiClientMoney(currency: .USD, value: 135),
    ]
}

private func makePreviewHoldings(
    entries: [KowalskiPortfolioClientEntryResponse],
    currentValues: [String: KowalskiClientMoney],
) -> [KowalskiPortfolioHoldingResponse] {
    KowalskiPortfolioHoldingsBuilder.make(entries: entries, currentValues: currentValues)
}

private func makePreviewNetWorth(
    entries: [KowalskiPortfolioClientEntryResponse],
    currentValues: [String: KowalskiClientMoney],
) -> KowalskiClientMoney {
    let holdings = makePreviewHoldings(entries: entries, currentValues: currentValues)
    let netWorthCurrency = holdings.first?.totalValue.currency ?? .USD
    let netWorthValue = holdings.sum(by: \.totalValue.value)

    return KowalskiClientMoney(currency: netWorthCurrency, value: netWorthValue)
}

private func makePreviewDashboards() -> KowalskiPortfolioDashboardsResponse {
    KowalskiPortfolioDashboardsResponse(
        portfolioGrowthOverTime: KowalskiPortfolioGrowthOverTimeResponse(
            currency: .USD,
            points: [
                KowalskiPortfolioGrowthPointResponse(
                    date: Date(timeIntervalSince1970: 1_766_074_040),
                    value: 540,
                    isCurrent: false,
                ),
                KowalskiPortfolioGrowthPointResponse(
                    date: Date(timeIntervalSince1970: 1_766_160_440),
                    value: 1420,
                    isCurrent: false,
                ),
                KowalskiPortfolioGrowthPointResponse(
                    date: Date(timeIntervalSince1970: 1_766_246_840),
                    value: 3536.5,
                    isCurrent: true,
                ),
            ],
        ),
    )
}

private func makePreviewValidationIssue() -> KowalskiClientValidationIssue {
    KowalskiClientValidationIssue(
        code: "too_small",
        path: ["amount"],
        message: "Number must be greater than 0",
    )
}
