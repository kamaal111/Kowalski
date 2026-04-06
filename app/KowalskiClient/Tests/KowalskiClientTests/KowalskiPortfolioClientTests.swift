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
