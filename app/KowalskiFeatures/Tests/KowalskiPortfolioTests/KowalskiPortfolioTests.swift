//
//  KowalskiPortfolioTests.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 3/29/26.
//

import ForexKit
import Foundation
@testable import KowalskiClient
@testable import KowalskiPortfolio
import Testing

@MainActor
@Suite("Portfolio Feature Tests")
struct KowalskiPortfolioTests {
    @Test
    func `Store transaction should turn the first validation issue into the message shown to the user`() async throws {
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .failure(
                .badRequest(
                    errorCode: "INVALID_PAYLOAD",
                    validations: [
                        KowalskiClientValidationIssue(
                            code: "too_small",
                            path: ["amount"],
                            message: "Number must be greater than 0",
                        ),
                    ],
                ),
            ),
            listEntriesResult: .success([]),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await #require(throws: StoreTransactionErrors.badRequest(validations: [
            KowalskiClientValidationIssue(
                code: "too_small",
                path: ["amount"],
                message: "Number must be greater than 0",
            ),
        ])) {
            try await portfolio.storeTransaction(makeTransactionPayload(amount: 0)).get()
        }
    }

    @Test
    func `Store transaction should refresh the list after a successful create`() async throws {
        let createdEntry = makePortfolioEntryResponse(amount: 10)
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(createdEntry),
            listEntriesResult: .success([createdEntry]),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.storeTransaction(makeTransactionPayload(amount: 10)).get()

        #expect(portfolio.entries.map(\.stock.name) == ["Apple Inc."])
        #expect(await portfolioClient.createEntryCallCount == 1)
        #expect(await portfolioClient.listEntriesCallCount == 1)
    }
}

private actor MockPortfolioClient: KowalskiPortfolioClient {
    private(set) var createEntryCallCount = 0
    private(set) var listEntriesCallCount = 0

    private let createEntryResult: Result<
        KowalskiPortfolioClientEntryResponse,
        KowalskiPortfolioClientCreateEntryErrors,
    >
    private let listEntriesResult: Result<
        [KowalskiPortfolioClientEntryResponse],
        KowalskiPortfolioClientListEntriesErrors,
    >

    init(
        createEntryResult: Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors>,
        listEntriesResult: Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors>,
    ) {
        self.createEntryResult = createEntryResult
        self.listEntriesResult = listEntriesResult
    }

    func listEntries() async
        -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors>
    {
        listEntriesCallCount += 1

        return listEntriesResult
    }

    func createEntry(
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> {
        createEntryCallCount += 1

        return createEntryResult
    }
}

private func makeTransactionPayload(amount: Double) -> TransactionPayload {
    TransactionPayload(
        stock: Stock(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchangeDispatch: "NASDAQ",
        ),
        amount: amount,
        purchasePrice: Money(currency: .USD, value: 150.5),
        transactionType: .purchase,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makePortfolioEntryResponse(amount: Double) -> KowalskiPortfolioClientEntryResponse {
    KowalskiPortfolioClientEntryResponse(
        id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
        stock: KowalskiClientStockItem(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchangeDispatch: "NASDAQ",
        ),
        amount: amount,
        purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
        transactionType: .buy,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}
