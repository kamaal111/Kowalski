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
