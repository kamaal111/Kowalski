//
//  KowalskiPortfolioTests.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 3/29/26.
//

import Foundation
@testable import KowalskiClient
import KowalskiFeaturesConfig
@testable import KowalskiPortfolio
import Testing

@MainActor
@Suite("Portfolio Feature Tests", .serialized)
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
    func `Store transaction should refresh the overview after a successful create`() async throws {
        let createdEntry = makePortfolioEntryResponse(amount: 10)
        let overview = makePortfolioOverviewResponse(
            transactions: [createdEntry],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 185.45),
            ],
        )
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(createdEntry),
            overviewResult: .success(overview),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.storeTransaction(makeTransactionPayload(amount: 10)).get()

        #expect(portfolio.entries.map(\.stock.name) == ["Apple Inc."])
        #expect(portfolio.netWorth == 1854.5)
        #expect(await portfolioClient.createEntryCallCount == 1)
        #expect(await portfolioClient.getOverviewCallCount == 1)
        #expect(await portfolioClient.listEntriesCallCount == 0)
    }

    @Test
    func `Update transaction should turn the first validation issue into the message shown to the user`() async throws {
        let existingEntry = makePortfolioEntryResponse(amount: 10)
        let portfolioClient = MockPortfolioClient(
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
    func `Update transaction should refresh the overview and return the updated entry`() async throws {
        let initialEntry = makePortfolioEntryResponse(amount: 10)
        let updatedEntry = makePortfolioEntryResponse(amount: 15)
        let overview = makePortfolioOverviewResponse(
            transactions: [updatedEntry],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 200),
            ],
        )
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(initialEntry),
            updateEntryResult: .success(updatedEntry),
            overviewResult: .success(overview),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        let refreshedEntry = try await portfolio
            .updateTransaction(makeTransactionPayload(amount: 15), entryId: initialEntry.id)
            .get()

        #expect(refreshedEntry.id == initialEntry.id)
        #expect(refreshedEntry.amount == 15)
        #expect(portfolio.entries.map(\.amount) == [15])
        #expect(portfolio.netWorth == 3000)
        #expect(await portfolioClient.updateEntryCallCount == 1)
        #expect(await portfolioClient.getOverviewCallCount == 1)
        #expect(await portfolioClient.listEntriesCallCount == 0)
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
    func `Overview fetch should populate entries and derive current market net worth`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 10,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 2,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 120),
                    transactionType: .sell,
                ),
                makePortfolioEntryResponse(
                    stock: makeTeslaStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 300),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 50),
                "TSLA": KowalskiClientMoney(currency: "USD", value: 20),
            ],
        )
        let portfolioClient = MockPortfolioClient(overviewResult: .success(overview))
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.fetchOverview().get()

        #expect(portfolio.entries.count == 3)
        #expect(portfolio.netWorth == 420)
        #expect(await portfolioClient.getOverviewCallCount == 1)
    }

    @Test
    func `Overview fetch should adjust holdings for split transactions`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 2,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 3,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 0),
                    transactionType: .split,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 10),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth == 50)
    }

    @Test
    func `Overview fetch should return zero when holdings net to zero`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 110),
                    transactionType: .sell,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 200),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth == 0)
    }

    @Test
    func `Overview fetch should clear net worth when a held symbol is missing from current values`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [:],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth == nil)
    }

    @Test
    func `Overview fetch should clear net worth when current value currencies are mixed`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
                makePortfolioEntryResponse(
                    stock: makeTeslaStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 150),
                "TSLA": KowalskiClientMoney(currency: "EUR", value: 200),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth == nil)
    }

    @Test
    func `Overview fetch should update net worth on repeated refreshes`() async throws {
        let usdOverview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 2,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 100),
            ],
        )
        let eurOverview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 2,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "EUR", value: 80),
            ],
        )
        let portfolioClient = MockPortfolioClient(
            overviewResults: [
                .success(usdOverview),
                .success(eurOverview),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.fetchOverview().get()
        #expect(portfolio.netWorth == 200)

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth == 160)
        #expect(await portfolioClient.getOverviewCallCount == 2)
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
        #expect(sellFormValues.purchasePriceCurrency == buyEntry.purchasePrice.currency)

        #expect(buyFormValues.selectedStock?.symbol == "TSLA")
        #expect(buyFormValues.selectedStock?.name == "Tesla, Inc.")
        #expect(buyFormValues.selectedStock?.isin == "US88160R1014")
        #expect(buyFormValues.amount == "7")
        #expect(buyFormValues.transactionType == .purchase)
        #expect(buyFormValues.purchasePriceCurrency == sellEntry.purchasePrice.currency)
    }

    @Test
    func `Empty form values should default to the shared fallback currency when no preferred currency is given`() {
        let formValues = KowalskiPortfolioTransactionFormValues.empty()

        #expect(formValues.purchasePriceCurrency == KowalskiFeatureDefaults.fallbackCurrency)
        #expect(formValues.purchasePriceValue == "0")
        #expect(formValues.selectedStock == nil)
        #expect(formValues.transactionType == .purchase)
    }

    @Test
    func `Empty form values should use the given preferred currency`() {
        let formValues = KowalskiPortfolioTransactionFormValues.empty(preferredCurrency: .EUR)

        #expect(formValues.purchasePriceCurrency == .EUR)
    }

    @Test
    func `Paired create should use the source entry currency for purchase price`() {
        let entry = makePortfolioEntry(
            stock: makeAppleStock(),
            amount: 5,
            purchasePrice: Money(currency: .EUR, value: 130),
            transactionType: .purchase,
        )

        let formValues = KowalskiPortfolioTransactionFormValues.pairedCreate(
            from: entry,
            transactionType: .sell,
        )

        #expect(formValues.purchasePriceCurrency == .EUR)
        #expect(formValues.selectedStock?.symbol == "AAPL")
        #expect(formValues.amount == "5")
        #expect(formValues.transactionType == .sell)
    }
}

private actor MockPortfolioClient: KowalskiPortfolioClient {
    private(set) var createEntryCallCount = 0
    private(set) var updateEntryCallCount = 0
    private(set) var listEntriesCallCount = 0
    private(set) var getOverviewCallCount = 0

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
    private var overviewResults: [Result<
        KowalskiPortfolioOverviewResponse,
        KowalskiPortfolioClientOverviewErrors,
    >]

    init(
        createEntryResult: Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientCreateEntryErrors> =
            .success(makePortfolioEntryResponse(amount: 10)),
        updateEntryResult: Result<KowalskiPortfolioClientEntryResponse, KowalskiPortfolioClientUpdateEntryErrors> =
            .success(makePortfolioEntryResponse(amount: 10)),
        listEntriesResult: Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors> =
            .success([]),
        overviewResult: Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors> = .success(
            makePortfolioOverviewResponse(transactions: [], currentValues: [:]),
        ),
        overviewResults: [Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors>] = [],
    ) {
        self.createEntryResult = createEntryResult
        self.updateEntryResult = updateEntryResult
        self.listEntriesResult = listEntriesResult
        self.overviewResults = overviewResults.isEmpty ? [overviewResult] : overviewResults
    }

    func listEntries() async
        -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientListEntriesErrors>
    {
        listEntriesCallCount += 1
        return listEntriesResult
    }

    func getOverview() async -> Result<KowalskiPortfolioOverviewResponse, KowalskiPortfolioClientOverviewErrors> {
        getOverviewCallCount += 1

        guard !overviewResults.isEmpty else {
            return .success(makePortfolioOverviewResponse(transactions: [], currentValues: [:]))
        }
        if overviewResults.count == 1 {
            return overviewResults[0]
        }

        return overviewResults.removeFirst()
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

private func makePortfolioOverviewResponse(
    transactions: [KowalskiPortfolioClientEntryResponse],
    currentValues: [String: KowalskiClientMoney],
) -> KowalskiPortfolioOverviewResponse {
    KowalskiPortfolioOverviewResponse(
        transactions: transactions,
        currentValues: currentValues,
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
        stock: makeAppleStockResponse(),
        amount: amount,
        purchasePrice: KowalskiClientMoney(currency: "USD", value: 150.5),
        transactionType: transactionType,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makePortfolioEntryResponse(
    stock: KowalskiClientStockItem,
    amount: Double,
    purchasePrice: KowalskiClientMoney,
    preferredCurrencyPurchasePrice: KowalskiClientMoney? = nil,
    transactionType: KowalskiClientPortfolioTransactionTypes,
) -> KowalskiPortfolioClientEntryResponse {
    KowalskiPortfolioClientEntryResponse(
        id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
        stock: stock,
        amount: amount,
        purchasePrice: purchasePrice,
        preferredCurrencyPurchasePrice: preferredCurrencyPurchasePrice,
        transactionType: transactionType,
        transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
    )
}

private func makePortfolioEntry(stock: Stock, amount: Double, transactionType: TransactionType) -> PortfolioEntry {
    makePortfolioEntry(
        stock: stock,
        amount: amount,
        purchasePrice: Money(currency: .USD, value: 150.5),
        transactionType: transactionType,
    )
}

private func makePortfolioEntry(
    stock: Stock,
    amount: Double,
    purchasePrice: Money,
    transactionType: TransactionType,
) -> PortfolioEntry {
    PortfolioEntry(
        id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
        createdAt: Date(timeIntervalSince1970: 1_766_246_840),
        updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
        stock: stock,
        amount: amount,
        purchasePrice: purchasePrice,
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

private func makeAppleStockResponse() -> KowalskiClientStockItem {
    KowalskiClientStockItem(
        symbol: "AAPL",
        exchange: "NMS",
        name: "Apple Inc.",
        isin: "US0378331005",
        sector: "Technology",
        industry: "Consumer Electronics",
        exchangeDispatch: "NASDAQ",
    )
}

private func makeTeslaStockResponse() -> KowalskiClientStockItem {
    KowalskiClientStockItem(
        symbol: "TSLA",
        exchange: "NMS",
        name: "Tesla, Inc.",
        isin: "US88160R1014",
        sector: "Consumer Cyclical",
        industry: "Auto Manufacturers",
        exchangeDispatch: "NASDAQ",
    )
}
