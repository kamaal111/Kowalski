//
//  KowalskiPortfolioClientTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("Portfolio Client Tests")
struct KowalskiPortfolioClientTests {
    @Test
    func `Create entry should expose validation issues from a bad request response`() async throws {
        let responseBody = Data(
            """
            {
              "message": "Invalid payload",
              "code": "INVALID_PAYLOAD",
              "context": {
                "validations": [
                  {
                    "code": "too_small",
                    "path": ["amount"],
                    "message": "Number must be greater than 0"
                  }
                ]
              }
            }
            """.utf8,
        )
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .badRequest, body: responseBody),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        try await #require(throws: KowalskiPortfolioClientCreateEntryErrors.badRequest(
            errorCode: "INVALID_PAYLOAD",
            validations: [
                KowalskiClientValidationIssue(
                    code: "too_small",
                    path: ["amount"],
                    message: "Number must be greater than 0",
                ),
            ],
        )) {
            try await portfolioClient.createEntry(payload: makeCreateEntryPayload()).get()
        }

        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/portfolio/entries")
        #expect(request.method == .post)
    }

    @Test
    func `Bulk create entries should send the expected request body`() async throws {
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .created, body: Data("[]".utf8)),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        _ = try await portfolioClient.bulkCreateEntries(
            entries: [
                makeBulkCreateEntryPayload(id: "550e8400-e29b-41d4-a716-446655440000"),
                makeBulkCreateEntryPayload(id: nil),
            ],
        ).get()

        let request = try #require(transport.capturedRequests.first)
        let body = try #require(transport.capturedBodies.first)
        let decodedBody = try JSONDecoder().decode(BulkCreateRequestBody.self, from: #require(body))

        #expect(request.path == "/app-api/portfolio/entries/bulk")
        #expect(request.method == .post)
        #expect(decodedBody.entries.count == 2)
        #expect(decodedBody.entries[0].id == "550e8400-e29b-41d4-a716-446655440000")
        #expect(decodedBody.entries[1].id == nil)
    }

    @Test
    func `Bulk create entries should map a successful response`() async throws {
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .created, body: makeBulkCreateEntriesResponseBody()),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        let entries = try await portfolioClient.bulkCreateEntries(
            entries: [makeBulkCreateEntryPayload(id: "550e8400-e29b-41d4-a716-446655440000")],
        ).get()

        #expect(entries.count == 2)
        #expect(entries[0].stock.symbol == "AAPL")
        #expect(entries[1].stock.symbol == "TSLA")
    }

    @Test
    func `Bulk create entries should support empty success responses`() async throws {
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .created, body: Data("[]".utf8)),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        let entries = try await portfolioClient.bulkCreateEntries(entries: []).get()

        #expect(entries.isEmpty)
    }

    @Test
    func `Bulk create entries should map internal server errors`() async throws {
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(
                    status: .internalServerError,
                    body: makeErrorResponseBody(
                        message: "Bulk portfolio entry persistence failed",
                        code: "PORTFOLIO_ENTRY_PERSISTENCE_FAILED",
                    ),
                ),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        try await #require(throws: KowalskiPortfolioClientBulkCreateEntriesErrors.internalServerError) {
            try await portfolioClient.bulkCreateEntries(
                entries: [makeBulkCreateEntryPayload(id: "550e8400-e29b-41d4-a716-446655440000")],
            ).get()
        }
    }

    @Test
    func `Bulk create entries should map unauthorized errors`() async throws {
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(
                    status: .unauthorized,
                    body: makeErrorResponseBody(
                        message: "Authentication failed",
                        code: "AUTHENTICATION_FAILED",
                    ),
                ),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        try await #require(throws: KowalskiPortfolioClientBulkCreateEntriesErrors.unauthorized) {
            try await portfolioClient.bulkCreateEntries(
                entries: [makeBulkCreateEntryPayload(id: "550e8400-e29b-41d4-a716-446655440000")],
            ).get()
        }
    }

    @Test
    func `List entries should decode preferred currency purchase prices`() async throws {
        let responseBody = Data(
            """
            [
              {
                "id": "cd81dbd7-3efa-42b3-8127-c1589279542f",
                "created_at": "2025-12-20T12:00:00Z",
                "updated_at": "2025-12-20T12:00:00Z",
                "stock": {
                  "symbol": "AAPL",
                  "exchange": "NMS",
                  "name": "Apple Inc.",
                  "isin": "US0378331005",
                  "sector": "Technology",
                  "industry": "Consumer Electronics",
                  "exchange_dispatch": "NASDAQ"
                },
                "amount": 10,
                "purchase_price": {
                  "currency": "USD",
                  "value": 150.5
                },
                "preferred_currency_purchase_price": {
                  "currency": "EUR",
                  "value": 138.07
                },
                "transaction_type": "buy",
                "transaction_date": "2025-12-20T10:30:00Z"
              }
            ]
            """.utf8,
        )
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .ok, body: responseBody),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        let entries = try await portfolioClient.listEntries().get()

        #expect(entries.count == 1)
        #expect(entries.first?.purchasePrice.currency == "USD")
        #expect(entries.first?.preferredCurrencyPurchasePrice?.currency == "EUR")
        #expect(entries.first?.preferredCurrencyPurchasePrice?.value == 138.07)
    }

    @Test
    func `Get overview should decode transactions and current values`() async throws {
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .ok, body: makeOverviewResponseBody()),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let portfolioClient = KowalskiPortfolioClientFactory.default(client: client)

        let overview = try await portfolioClient.getOverview().get()

        #expect(overview.transactions.count == 1)
        #expect(overview.transactions.first?.stock.symbol == "AAPL")
        #expect(overview.currentValues["AAPL"]?.currency == "EUR")
        #expect(overview.currentValues["AAPL"]?.value == 185.45)

        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/portfolio/overview")
        #expect(request.method == .get)
    }
}

private func makeGeneratedClient(transport: some ClientTransport) throws -> Client {
    try Client(
        serverURL: #require(URL(string: "https://api.example.com")),
        transport: transport,
    )
}

private func makeCreateEntryPayload() -> KowalskiPortfolioCreateEntryPayload {
    KowalskiPortfolioCreateEntryPayload(
        stock: KowalskiClientStockItem(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            isin: "US0378331005",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchangeDispatch: "NASDAQ",
        ),
        amount: 0,
        purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
        transactionType: .buy,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makeBulkCreateEntryPayload(id: String?) -> KowalskiPortfolioBulkCreateEntryItemPayload {
    KowalskiPortfolioBulkCreateEntryItemPayload(
        id: id,
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
        purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
        transactionType: .buy,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makeOverviewResponseBody() -> Data {
    Data(
        """
        {
          "transactions": [
            {
              "id": "cd81dbd7-3efa-42b3-8127-c1589279542f",
              "created_at": "2025-12-20T12:00:00Z",
              "updated_at": "2025-12-20T12:00:00Z",
              "stock": {
                "symbol": "AAPL",
                "exchange": "NMS",
                "name": "Apple Inc.",
                "isin": "US0378331005",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "exchange_dispatch": "NASDAQ"
              },
              "amount": 10,
              "purchase_price": {
                "currency": "USD",
                "value": 150.5
              },
              "preferred_currency_purchase_price": {
                "currency": "EUR",
                "value": 138.07
              },
              "transaction_type": "buy",
              "transaction_date": "2025-12-20T10:30:00Z"
            }
          ],
          "current_values": {
            "AAPL": {
              "currency": "EUR",
              "value": 185.45
            }
          }
        }
        """.utf8,
    )
}

private func makeBulkCreateEntriesResponseBody() -> Data {
    Data(
        """
        [
          {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "created_at": "2025-12-20T12:00:00Z",
            "updated_at": "2025-12-20T12:00:00Z",
            "stock": {
              "symbol": "AAPL",
              "exchange": "NMS",
              "name": "Apple Inc.",
              "isin": "US0378331005",
              "sector": "Technology",
              "industry": "Consumer Electronics",
              "exchange_dispatch": "NASDAQ"
            },
            "amount": 10,
            "purchase_price": {
              "currency": "USD",
              "value": 150.5
            },
            "preferred_currency_purchase_price": {
              "currency": "EUR",
              "value": 138.07
            },
            "transaction_type": "buy",
            "transaction_date": "2025-12-20T10:30:00Z"
          },
          {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "created_at": "2025-12-20T12:00:00Z",
            "updated_at": "2025-12-20T12:00:00Z",
            "stock": {
              "symbol": "TSLA",
              "exchange": "NMS",
              "name": "Tesla, Inc.",
              "isin": "US88160R1014",
              "sector": "Consumer Cyclical",
              "industry": "Auto Manufacturers",
              "exchange_dispatch": "NASDAQ"
            },
            "amount": 7,
            "purchase_price": {
              "currency": "USD",
              "value": 210.25
            },
            "preferred_currency_purchase_price": {
              "currency": "EUR",
              "value": 193.42
            },
            "transaction_type": "sell",
            "transaction_date": "2025-12-21T10:30:00Z"
          }
        ]
        """.utf8,
    )
}

private struct BulkCreateRequestBody: Decodable {
    let entries: [BulkCreateRequestEntry]
}

private struct BulkCreateRequestEntry: Decodable {
    let id: String?
}

private func makeErrorResponseBody(message: String, code: String) -> Data {
    Data(
        """
        {
          "message": "\(message)",
          "code": "\(code)"
        }
        """.utf8,
    )
}
