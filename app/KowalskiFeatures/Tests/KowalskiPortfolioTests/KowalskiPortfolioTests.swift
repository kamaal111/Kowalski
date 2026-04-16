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
import KowalskiUtils
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
        #expect(portfolio.netWorth?.value == 1854.5)
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
        #expect(portfolio.netWorth?.value == 3000)
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
        #expect(portfolio.netWorth?.value == 420)
        #expect(await portfolioClient.getOverviewCallCount == 1)
    }

    @Test
    func `Overview fetch should compute a profit when current value exceeds purchase cost`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 10,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 150),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth?.value == 1500)
        #expect(portfolio.allTimeProfit?.currency == .USD)
        #expect(portfolio.allTimeProfit?.value == 500)
        #expect(portfolio.allTimeProfitPercentage == 50)
    }

    @Test
    func `Overview fetch should compute a loss when current value is below purchase cost`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 5,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 200),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 100),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth?.value == 500)
        #expect(portfolio.allTimeProfit?.value == -500)
        #expect(portfolio.allTimeProfitPercentage == -50)
    }

    @Test
    func `Overview fetch should report zero profit when current value equals purchase cost`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 4,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 100),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth?.value == 400)
        #expect(portfolio.allTimeProfit?.value == 0)
        #expect(portfolio.allTimeProfitPercentage == 0)
    }

    @Test
    func `Overview fetch should reduce cost basis by sell proceeds when computing profit`() async throws {
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
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .sell,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 150),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth?.value == 1200)
        #expect(portfolio.allTimeProfit?.value == 400)
        #expect(portfolio.allTimeProfitPercentage == 50)
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

        #expect(portfolio.netWorth?.value == 50)
        #expect(portfolio.allTimeProfit?.value == -150)
        #expect(portfolio.allTimeProfitPercentage == -75)
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

        #expect(portfolio.netWorth?.value == 0)
    }

    @Test
    func `Overview fetch should use preferred currency purchase price for cost basis when available`() async throws {
        let overview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    preferredCurrencyPurchasePrice: KowalskiClientMoney(currency: "EUR", value: 90),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "EUR", value: 120),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: MockPortfolioClient(overviewResult: .success(overview))),
        )

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth?.value == 120)
        #expect(portfolio.allTimeProfit?.currency == .EUR)
        #expect(portfolio.allTimeProfit?.value == 30)
        let allTimeProfitPercentage = try #require(portfolio.allTimeProfitPercentage)
        #expect(abs(allTimeProfitPercentage - 33.333333333333336) < 0.000001)
    }

    @Test
    func `Overview fetch should clear all time profit when net worth is unavailable`() async throws {
        let populatedOverview = makePortfolioOverviewResponse(
            transactions: [
                makePortfolioEntryResponse(
                    stock: makeAppleStockResponse(),
                    amount: 1,
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                    transactionType: .buy,
                ),
            ],
            currentValues: [
                "AAPL": KowalskiClientMoney(currency: "USD", value: 150),
            ],
        )
        let unavailableOverview = makePortfolioOverviewResponse(
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
        let portfolioClient = MockPortfolioClient(
            overviewResults: [
                .success(populatedOverview),
                .success(unavailableOverview),
            ],
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: portfolioClient),
        )

        try await portfolio.fetchOverview().get()
        #expect(portfolio.netWorth?.value == 150)
        #expect(portfolio.allTimeProfit?.value == 50)

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth == nil)
        #expect(portfolio.allTimeProfit == nil)
        #expect(portfolio.allTimeProfitPercentage == nil)
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
    func `Overview fetch should report nil profit percentage when cost basis is zero`() async throws {
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
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
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

        #expect(portfolio.netWorth?.value == 0)
        #expect(portfolio.allTimeProfit == nil)
        #expect(portfolio.allTimeProfitPercentage == nil)
    }

    @Test
    func `Overview fetch should report nil profit when all holdings have been sold`() async throws {
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
                    purchasePrice: KowalskiClientMoney(currency: "USD", value: 118.73),
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

        #expect(portfolio.netWorth?.value == 0)
        #expect(portfolio.allTimeProfit == nil)
        #expect(portfolio.allTimeProfitPercentage == nil)
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
        #expect(portfolio.netWorth?.value == 200)

        try await portfolio.fetchOverview().get()

        #expect(portfolio.netWorth?.value == 160)
        #expect(await portfolioClient.getOverviewCallCount == 2)
    }

    @Test
    func `Export transactions should write the expected header row`() async throws {
        let entry = makePortfolioEntryResponse(amount: 10)
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(
                portfolio: MockPortfolioClient(
                    overviewResult: .success(
                        makePortfolioOverviewResponse(
                            transactions: [entry],
                            currentValues: ["AAPL": KowalskiClientMoney(currency: "USD", value: 185.45)],
                        ),
                    ),
                ),
            ),
        )
        try await portfolio.fetchOverview().get()

        let url = try await portfolio.exportTransactions().get()
        let lines = try readLines(from: url)

        #expect(
            lines.first ==
                "id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date",
        )
    }

    @Test
    func `Export transactions should encode all fields including the id`() async throws {
        let entry = makePortfolioEntryResponse(
            stock: makeTeslaStockResponse(),
            amount: 7,
            purchasePrice: KowalskiClientMoney(currency: "USD", value: 210.25),
            transactionType: .sell,
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(
                portfolio: MockPortfolioClient(
                    overviewResult: .success(
                        makePortfolioOverviewResponse(
                            transactions: [entry],
                            currentValues: ["TSLA": KowalskiClientMoney(currency: "USD", value: 420.5)],
                        ),
                    ),
                ),
            ),
        )
        try await portfolio.fetchOverview().get()

        let url = try await portfolio.exportTransactions().get()
        let lines = try readLines(from: url)
        let dataRow = try #require(lines.dropFirst().first)

        #expect(dataRow.contains(entry.id))
        #expect(dataRow.contains("TSLA"))
        #expect(dataRow.contains("\"Tesla, Inc.\""))
        #expect(dataRow.contains("7.0"))
        #expect(dataRow.contains("sell"))
    }

    @Test
    func `Export and import transactions should round trip quoted fields and split transaction type`() throws {
        let entry = makePortfolioEntry(
            stock: Stock(
                symbol: "BRK.B",
                exchange: "NYQ",
                name: "Berkshire Hathaway\nClass \"B\", Inc.",
                isin: "US0846707026",
                sector: "Financial Services",
                industry: "Insurance",
                exchangeDispatch: "NYSE",
            ),
            amount: 3,
            purchasePrice: Money(currency: .USD, value: 490.75),
            transactionType: .split,
        )

        let url = try PortfolioTransactionsCSV.export(entries: [entry]).get()
        let parsedCSV = try PortfolioTransactionsCSV.import(from: url).get()
        let importedEntry = try #require(parsedCSV.entries.first)

        #expect(parsedCSV.entries.count == 1)
        #expect(parsedCSV.malformedRowNumbers.isEmpty)
        #expect(importedEntry.stock.symbol == "BRK.B")
        #expect(importedEntry.stock.name == "Berkshire Hathaway\nClass \"B\", Inc.")
        #expect(importedEntry.transactionType == .split)
        #expect(importedEntry.purchasePrice.value == 490.75)
    }

    @Test
    func `Export transactions should write blank optional stock fields as empty cells`() throws {
        let entry = makePortfolioEntry(
            stock: Stock(
                symbol: "TST",
                exchange: "NMS",
                name: "Test Co",
                isin: nil,
                sector: nil,
                industry: nil,
                exchangeDispatch: nil,
            ),
            amount: 1.5,
            purchasePrice: Money(currency: .USD, value: 42),
            transactionType: .purchase,
        )

        let url = try PortfolioTransactionsCSV.export(entries: [entry]).get()
        let lines = try readLines(from: url)
        let dataRow = try #require(lines.dropFirst().first)

        #expect(!dataRow.contains("nil"))
        #expect(dataRow.contains("Test Co,,,,,1.5"))
    }

    @Test
    func `Export transactions with no entries should produce a headers-only file`() async throws {
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: MockPortfolioClient()))

        let url = try await portfolio.exportTransactions().get()
        let lines = try readLines(from: url)

        #expect(lines.count == 1)
    }

    @Test
    func `Download transactions template should produce a headers-only file`() async throws {
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: MockPortfolioClient()))

        let url = try await portfolio.downloadTransactionsTemplate().get()
        let lines = try readLines(from: url)

        #expect(
            lines ==
                [
                    "id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date",
                ],
        )
    }

    @Test
    func `Import transactions should read security scoped URLs while the resource is active`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z
            """,
        )
        let securityScopedURL = TrackingSecurityScopedURL(url: csvURL)

        let contents = try SecurityScopedFileAccess.readString(from: securityScopedURL)

        #expect(contents.contains("AAPL"))
        #expect(securityScopedURL.startAccessCallCount == 1)
        #expect(securityScopedURL.stopAccessCallCount == 1)
    }

    @Test
    func `Import transactions CSV should return invalidFormat when required columns are missing`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            symbol,exchange,name
            AAPL,NMS,Apple Inc.
            """,
        )

        try #require(throws: PortfolioTransactionsCSVError.invalidFormat) {
            try PortfolioTransactionsCSV.import(from: csvURL).get()
        }
    }

    @Test
    func `Import transactions CSV should preserve quoted newlines and escaped quotes`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,BRK.B,NYQ,"Berkshire Hathaway
            Class ""B""\",US0846707026,Financial Services,Insurance,NYSE,3,USD,490.75,buy,2025-12-20T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()
        let importedEntry = try #require(parsedCSV.entries.first)

        #expect(parsedCSV.entries.count == 1)
        #expect(parsedCSV.malformedRowNumbers.isEmpty)
        #expect(importedEntry.stock.symbol == "BRK.B")
        #expect(importedEntry.stock.name == "Berkshire Hathaway\nClass \"B\"")
        #expect(importedEntry.purchasePrice.value == 490.75)
    }

    @Test
    func `Import transactions CSV should accept timestamps with and without fractional seconds`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00Z
            550e8400-e29b-41d4-a716-446655440001,TSLA,NMS,"Tesla, Inc.",US88160R1014,Consumer Cyclical,Auto Manufacturers,NASDAQ,7,USD,210.25,sell,2025-12-21T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()

        #expect(parsedCSV.entries.count == 2)
        #expect(parsedCSV.malformedRowNumbers.isEmpty)
        #expect(parsedCSV.entries.map(\.transactionType) == [.buy, .sell])
    }

    @Test
    func `Import transactions CSV should ignore empty lines between data rows`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z

            550e8400-e29b-41d4-a716-446655440001,TSLA,NMS,"Tesla, Inc.",US88160R1014,Consumer Cyclical,Auto Manufacturers,NASDAQ,7,USD,210.25,sell,2025-12-21T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()

        #expect(parsedCSV.entries.map(\.stock.symbol) == ["AAPL", "TSLA"])
        #expect(parsedCSV.malformedRowNumbers.isEmpty)
    }

    @Test
    func `Import transactions CSV should trim surrounding whitespace before validation`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
             550e8400-e29b-41d4-a716-446655440000 , AAPL , NMS , Apple Inc. , US0378331005 , Technology , Consumer Electronics , NASDAQ , 10 , USD , 150.5 , buy , 2025-12-20T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()
        let importedEntry = try #require(parsedCSV.entries.first)

        #expect(parsedCSV.entries.count == 1)
        #expect(parsedCSV.malformedRowNumbers.isEmpty)
        #expect(importedEntry.id == "550e8400-e29b-41d4-a716-446655440000")
        #expect(importedEntry.stock.symbol == "AAPL")
        #expect(importedEntry.stock.exchange == "NMS")
    }

    @Test
    func `Import transactions CSV should treat required fields with only whitespace as malformed rows`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,   ,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()

        #expect(parsedCSV.entries.isEmpty)
        #expect(parsedCSV.malformedRowNumbers == [2])
    }

    @Test
    func `Import transactions CSV should skip malformed rows and report their row numbers`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z
            550e8400-e29b-41d4-a716-446655440001,TSLA,NMS,Tesla Inc.,US88160R1014,Consumer Cyclical,Auto Manufacturers,NASDAQ,INVALID,USD,210.25,sell,2025-12-21T00:00:00.000Z
            550e8400-e29b-41d4-a716-446655440002,MSFT,NMS,Microsoft Corp.,US5949181045,Technology,Software,NASDAQ,5,USD,320.1,buy,2025-12-22T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()

        #expect(parsedCSV.entries.count == 2)
        #expect(parsedCSV.entries.map(\.stock.symbol) == ["AAPL", "MSFT"])
        #expect(parsedCSV.malformedRowNumbers == [3])
    }

    @Test
    func `Import transactions CSV should treat unterminated quoted fields as malformed rows`() throws {
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,"Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z
            """,
        )

        let parsedCSV = try PortfolioTransactionsCSV.import(from: csvURL).get()

        #expect(parsedCSV.entries.isEmpty)
        #expect(parsedCSV.malformedRowNumbers == [2])
    }

    @Test
    func `Import transactions should call bulkCreateEntries with the parsed payload`() async throws {
        let portfolioClient = MockPortfolioClient(
            bulkCreateEntriesResult: .success([]),
            overviewResult: .success(makePortfolioOverviewResponse(transactions: [], currentValues: [:])),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,10,USD,150.5,buy,2025-12-20T00:00:00.000Z
            550e8400-e29b-41d4-a716-446655440001,TSLA,NMS,"Tesla, Inc.",US88160R1014,Consumer Cyclical,Auto Manufacturers,NASDAQ,7,USD,210.25,sell,2025-12-21T00:00:00.000Z
            """,
        )

        try await portfolio.importTransactions(from: csvURL).get()

        let capturedEntries = try #require(await portfolioClient.bulkCreateEntriesPayloads.first)
        #expect(capturedEntries.count == 2)
        #expect(capturedEntries[0].id == "550e8400-e29b-41d4-a716-446655440000")
        #expect(capturedEntries[0].stock.symbol == "AAPL")
        #expect(capturedEntries[0].amount == 10)
        #expect(capturedEntries[0].transactionType == .buy)
        #expect(capturedEntries[1].id == "550e8400-e29b-41d4-a716-446655440001")
        #expect(capturedEntries[1].stock.name == "Tesla, Inc.")
        #expect(capturedEntries[1].purchasePrice.value == 210.25)
        #expect(capturedEntries[1].transactionType == .sell)
    }

    @Test
    func `Import transactions should refresh the overview after success`() async throws {
        let refreshedEntry = makePortfolioEntryResponse(amount: 12)
        let portfolioClient = MockPortfolioClient(
            bulkCreateEntriesResult: .success([refreshedEntry]),
            overviewResult: .success(
                makePortfolioOverviewResponse(
                    transactions: [refreshedEntry],
                    currentValues: ["AAPL": KowalskiClientMoney(currency: "USD", value: 200)],
                ),
            ),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))
        let csvURL = try makeCSVFile(
            contents: """
            id,symbol,exchange,name,isin,sector,industry,exchange_dispatch,amount,purchase_price_currency,purchase_price_value,transaction_type,transaction_date
            550e8400-e29b-41d4-a716-446655440000,AAPL,NMS,Apple Inc.,US0378331005,Technology,Consumer Electronics,NASDAQ,12,USD,150.5,buy,2025-12-20T00:00:00.000Z
            """,
        )

        try await portfolio.importTransactions(from: csvURL).get()

        #expect(portfolio.entries.map(\.amount) == [12])
        #expect(await portfolioClient.bulkCreateEntriesCallCount == 1)
        #expect(await portfolioClient.getOverviewCallCount == 1)
    }

    @Test
    func `Import transactions should fail fast when the CSV header is missing required columns`() async throws {
        let portfolioClient = MockPortfolioClient()
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))
        let csvURL = try makeCSVFile(
            contents: """
            symbol,exchange,name
            AAPL,NMS,Apple Inc.
            """,
        )

        try await #require(throws: ImportTransactionErrors.invalidFormat) {
            try await portfolio.importTransactions(from: csvURL).get()
        }

        #expect(await portfolioClient.bulkCreateEntriesCallCount == 0)
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
    private(set) var bulkCreateEntriesCallCount = 0
    private(set) var updateEntryCallCount = 0
    private(set) var listEntriesCallCount = 0
    private(set) var getOverviewCallCount = 0
    private(set) var bulkCreateEntriesPayloads: [[KowalskiPortfolioBulkCreateEntryItemPayload]] = []

    private let createEntryResult: Result<
        KowalskiPortfolioClientEntryResponse,
        KowalskiPortfolioClientCreateEntryErrors,
    >
    private let bulkCreateEntriesResult: Result<
        [KowalskiPortfolioClientEntryResponse],
        KowalskiPortfolioClientBulkCreateEntriesErrors,
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
        bulkCreateEntriesResult: Result<
            [KowalskiPortfolioClientEntryResponse],
            KowalskiPortfolioClientBulkCreateEntriesErrors,
        > = .success([]),
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
        self.bulkCreateEntriesResult = bulkCreateEntriesResult
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

    func bulkCreateEntries(
        entries: [KowalskiPortfolioBulkCreateEntryItemPayload],
    ) async -> Result<[KowalskiPortfolioClientEntryResponse], KowalskiPortfolioClientBulkCreateEntriesErrors> {
        bulkCreateEntriesCallCount += 1
        bulkCreateEntriesPayloads.append(entries)

        return bulkCreateEntriesResult
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

private func readLines(from url: URL) throws -> [String] {
    try String(contentsOf: url, encoding: .utf8)
        .split(separator: "\n", omittingEmptySubsequences: true)
        .map(String.init)
}

private func makeCSVFile(contents: String) throws -> URL {
    let url = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension("csv")
    try contents.write(to: url, atomically: true, encoding: .utf8)

    return url
}

private final class TrackingSecurityScopedURL: SecurityScopedFileURL {
    let fileURL: URL

    private(set) var startAccessCallCount = 0
    private(set) var stopAccessCallCount = 0

    init(url: URL) {
        fileURL = url
    }

    func startAccessingSecurityScopedResource() -> Bool {
        startAccessCallCount += 1

        return true
    }

    func stopAccessingSecurityScopedResource() {
        stopAccessCallCount += 1
    }
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
