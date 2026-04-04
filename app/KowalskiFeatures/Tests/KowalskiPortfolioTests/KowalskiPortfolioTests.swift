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
            updateEntryResult: .success(makePortfolioEntryResponse(amount: 10)),
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
    func `Store transaction validation errors should format the first issue for the user`() {
        let error = StoreTransactionErrors.badRequest(validations: [
            KowalskiClientValidationIssue(
                code: "too_small",
                path: ["amount"],
                message: "Number must be greater than 0",
            ),
        ])

        #expect(error.errorDescription == "amount: Number must be greater than 0")
    }

    @Test
    func `Store transaction should refresh the list after a successful create`() async throws {
        let createdEntry = makePortfolioEntryResponse(amount: 10)
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(createdEntry),
            updateEntryResult: .success(createdEntry),
            listEntriesResult: .success([createdEntry]),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.storeTransaction(makeTransactionPayload(amount: 10)).get()

        #expect(portfolio.entries.map(\.stock.name) == ["Apple Inc."])
        #expect(await portfolioClient.createEntryCallCount == 1)
        #expect(await portfolioClient.listEntriesCallCount == 1)
    }

    @Test
    func `Update transaction should turn the first validation issue into the message shown to the user`() async throws {
        let existingEntry = makePortfolioEntryResponse(amount: 10)
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(existingEntry),
            updateEntryResult: .failure(
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
            listEntriesResult: .success([existingEntry]),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await #require(throws: UpdateTransactionErrors.badRequest(validations: [
            KowalskiClientValidationIssue(
                code: "too_small",
                path: ["amount"],
                message: "Number must be greater than 0",
            ),
        ])) {
            try await portfolio.updateTransaction(makeTransactionPayload(amount: 0), entryId: existingEntry.id).get()
        }
    }

    @Test
    func `Update transaction should refresh the list and return the updated entry`() async throws {
        let initialEntry = makePortfolioEntryResponse(amount: 10)
        let updatedEntry = makePortfolioEntryResponse(amount: 15)
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(initialEntry),
            updateEntryResult: .success(updatedEntry),
            listEntriesResult: .success([updatedEntry]),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        let refreshedEntry = try await portfolio
            .updateTransaction(makeTransactionPayload(amount: 15), entryId: initialEntry.id)
            .get()

        #expect(refreshedEntry.id == initialEntry.id)
        #expect(refreshedEntry.amount == 15)
        #expect(portfolio.entries.map(\.amount) == [15])
        #expect(await portfolioClient.updateEntryCallCount == 1)
        #expect(await portfolioClient.listEntriesCallCount == 1)
    }

    @Test
    func `Search stocks should preserve isin from the client response`() async throws {
        let stocksClient = MockStocksClient(
            searchResult: .success(
                KowalskiStocksSearchResponse(
                    quotes: [
                        KowalskiClientStockItem(
                            symbol: "AAPL",
                            exchange: "NMS",
                            name: "Apple Inc.",
                            isin: "US0378331005",
                            sector: "Technology",
                            industry: "Consumer Electronics",
                            exchangeDispatch: "NASDAQ",
                        ),
                    ],
                ),
            ),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(stocks: stocksClient))

        let stocks = try await portfolio.searchStocks(query: "AAPL").get()

        #expect(stocks.map(\.isin) == ["US0378331005"])
    }

    @Test
    func `Paired create form values should use the opposite transaction type`() throws {
        let buyEntry = makePortfolioEntry(
            stock: makeAppleStock(),
            amount: 10,
            transactionType: .purchase,
        )
        let sellEntry = makePortfolioEntry(
            stock: makeTeslaStock(),
            amount: 7,
            transactionType: .sell,
        )
        let pairedSellType = try #require(buyEntry.transactionType.pairedTransactionType)
        let pairedBuyType = try #require(sellEntry.transactionType.pairedTransactionType)

        let sellFormValues = KowalskiPortfolioTransactionFormValues.pairedCreate(
            from: buyEntry,
            transactionType: pairedSellType,
        )
        let buyFormValues = KowalskiPortfolioTransactionFormValues.pairedCreate(
            from: sellEntry,
            transactionType: pairedBuyType,
        )

        #expect(sellFormValues.selectedStock?.symbol == "AAPL")
        #expect(sellFormValues.selectedStock?.name == "Apple Inc.")
        #expect(sellFormValues.selectedStock?.isin == "US0378331005")
        #expect(sellFormValues.amount == "10")
        #expect(sellFormValues.transactionType == .sell)

        #expect(buyFormValues.selectedStock?.symbol == "TSLA")
        #expect(buyFormValues.selectedStock?.name == "Tesla, Inc.")
        #expect(buyFormValues.selectedStock?.isin == "US88160R1014")
        #expect(buyFormValues.amount == "7")
        #expect(buyFormValues.transactionType == .purchase)
    }
}

private actor MockPortfolioClient: KowalskiPortfolioClient {
    private(set) var createEntryCallCount = 0
    private(set) var updateEntryCallCount = 0
    private(set) var listEntriesCallCount = 0

    private let createEntryResult: Result<
        KowalskiPortfolioClientEntryResponse,
        KowalskiPortfolioClientCreateEntryErrors,
    >
    private let updateEntryResult: Result<
        KowalskiPortfolioClientEntryResponse,
        KowalskiPortfolioClientUpdateEntryErrors,
    >
    private let listEntriesResult: Result<
        [KowalskiPortfolioClientEntryResponse],
        KowalskiPortfolioClientListEntriesErrors,
    >

    init(
        createEntryResult: Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors>,
        updateEntryResult: Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientUpdateEntryErrors>,
        listEntriesResult: Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors>,
    ) {
        self.createEntryResult = createEntryResult
        self.updateEntryResult = updateEntryResult
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

    func updateEntry(
        entryId _: String,
        payload _: KowalskiPortfolioCreateEntryPayload,
    ) async -> Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientUpdateEntryErrors> {
        updateEntryCallCount += 1

        return updateEntryResult
    }
}

private actor MockStocksClient: KowalskiStocksClient {
    private let searchResult: Result<KowalskiStocksSearchResponse, KowalskiStocksSearchErrors>

    init(searchResult: Result<KowalskiStocksSearchResponse, KowalskiStocksSearchErrors>) {
        self.searchResult = searchResult
    }

    func search(query _: String) async -> Result<KowalskiStocksSearchResponse, KowalskiStocksSearchErrors> {
        searchResult
    }
}

private func makeTransactionPayload(amount: Double) -> TransactionPayload {
    TransactionPayload(
        stock: Stock(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            isin: "US0378331005",
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
    makePortfolioEntryResponse(amount: amount, transactionType: .buy)
}

private func makePortfolioEntryResponse(
    amount: Double,
    transactionType: KowalskiClientPortfolioTransactionTypes,
) -> KowalskiPortfolioClientEntryResponse {
    KowalskiPortfolioClientEntryResponse(
        id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
        stock: KowalskiClientStockItem(
            symbol: "AAPL",
            exchange: "NMS",
            name: "Apple Inc.",
            isin: "US0378331005",
            sector: "Technology",
            industry: "Consumer Electronics",
            exchangeDispatch: "NASDAQ",
        ),
        amount: amount,
        purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
        transactionType: transactionType,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makePortfolioEntry(stock: Stock, amount: Double, transactionType: TransactionType) -> PortfolioEntry {
    PortfolioEntry(
        id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
        stock: stock,
        amount: amount,
        purchasePrice: Money(currency: .USD, value: 150.5),
        transactionType: transactionType,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makeAppleStock() -> Stock {
    Stock(
        symbol: "AAPL",
        exchange: "NMS",
        name: "Apple Inc.",
        isin: "US0378331005",
        sector: "Technology",
        industry: "Consumer Electronics",
        exchangeDispatch: "NASDAQ",
    )
}

private func makeTeslaStock() -> Stock {
    Stock(
        symbol: "TSLA",
        exchange: "NMS",
        name: "Tesla, Inc.",
        isin: "US88160R1014",
        sector: "Consumer Cyclical",
        industry: "Auto Manufacturers",
        exchangeDispatch: "NASDAQ",
    )
}
