//
//  KowalskiStocksClientTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 4/3/26.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("Stocks Client Tests")
struct KowalskiStocksClientTests {
    @Test
    func `Search should decode isin values from the API response`() async throws {
        let responseBody = Data(
            """
            {
              "count": 1,
              "quotes": [
                {
                  "symbol": "AAPL",
                  "exchange": "NMS",
                  "name": "Apple Inc.",
                  "isin": "US0378331005",
                  "sector": "Technology",
                  "industry": "Consumer Electronics",
                  "exchange_dispatch": "NASDAQ"
                }
              ]
            }
            """.utf8,
        )
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .ok, body: responseBody),
            ],
        )
        let client = try Client(
            serverURL: #require(URL(string: "https://api.example.com")),
            transport: transport,
        )
        let stocksClient = KowalskiStocksClientFactory.deafault(client: client)

        let response = try await stocksClient.search(query: "AAPL").get()

        #expect(response.quotes.map(\.isin) == ["US0378331005"])

        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/stocks/search?q=AAPL")
        #expect(request.method == .get)
    }
}
