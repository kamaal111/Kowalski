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
    func `Net worth fetch should sum purchases and subtract sells in the preferred currency`() async throws {
        let listEntries = [
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 2,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeTeslaStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 40),
                transactionType: .sell,
            ),
        ]
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(listEntries[0]),
            updateEntryResult: .success(listEntries[0]),
            listEntriesResult: .success(listEntries),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.fetchEntries().get()
        await portfolio.fetchNetWorth(preferredCurrency: .USD)

        #expect(portfolio.netWorth == 160)
    }

    @Test
    func `Net worth fetch should exclude split transactions`() async throws {
        let listEntries = [
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 2,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 100),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeTeslaStockResponse(),
                amount: 10,
                purchasePrice: KowalskiClientMoney(currency: "EUR", value: 1000),
                transactionType: .split,
            ),
        ]
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(listEntries[0]),
            updateEntryResult: .success(listEntries[0]),
            listEntriesResult: .success(listEntries),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.fetchEntries().get()
        await portfolio.fetchNetWorth(preferredCurrency: .USD)

        #expect(portfolio.netWorth == 200)
    }

    @Test
    func `Net worth fetch should convert mixed currency entries into the preferred currency`() async throws {
        let listEntries = [
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 106.66),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeTeslaStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "GBP", value: 88.693),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 53.33),
                transactionType: .sell,
            ),
        ]
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(listEntries[0]),
            updateEntryResult: .success(listEntries[0]),
            listEntriesResult: .success(listEntries),
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: portfolioClient),
            forexKitConfiguration: makeMockForexKitConfiguration(responseBody: mixedCurrencyForexResponseBody),
        )

        try await portfolio.fetchEntries().get()
        await portfolio.fetchNetWorth(preferredCurrency: .EUR)

        let netWorth = try #require(portfolio.netWorth)
        #expect(abs(netWorth - 150) < 0.0001)
    }

    @Test
    func `Net worth fetch should clear net worth when fetched exchange rates use the wrong base currency`(
    ) async throws {
        let listEntries = [
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "GBP", value: 75),
                transactionType: .buy,
            ),
        ]
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(listEntries[0]),
            updateEntryResult: .success(listEntries[0]),
            listEntriesResult: .success(listEntries),
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: portfolioClient),
            forexKitConfiguration: makeMockForexKitConfiguration(responseBody: wrongBaseForexResponseBody),
        )

        try await portfolio.fetchEntries().get()
        await portfolio.fetchNetWorth(preferredCurrency: .EUR)

        #expect(portfolio.netWorth == nil)
    }

    @Test
    func `Net worth fetch should clear net worth when a fetched exchange rate is missing`() async throws {
        let listEntries = [
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 106.66),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeTeslaStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "GBP", value: 88.693),
                transactionType: .buy,
            ),
        ]
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(listEntries[0]),
            updateEntryResult: .success(listEntries[0]),
            listEntriesResult: .success(listEntries),
        )
        let portfolio = KowalskiPortfolio.testing(
            client: .testing(portfolio: portfolioClient),
            forexKitConfiguration: makeMockForexKitConfiguration(responseBody: missingRateForexResponseBody),
        )

        try await portfolio.fetchEntries().get()
        await portfolio.fetchNetWorth(preferredCurrency: .EUR)

        #expect(portfolio.netWorth == nil)
    }

    @Test
    func `Net worth should use ForexKit preview rates for mixed currencies`() async throws {
        let listEntries = [
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 106.66),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeTeslaStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "GBP", value: 88.693),
                transactionType: .buy,
            ),
            makePortfolioEntryResponse(
                stock: makeAppleStockResponse(),
                amount: 1,
                purchasePrice: KowalskiClientMoney(currency: "USD", value: 53.33),
                transactionType: .sell,
            ),
        ]
        let portfolioClient = MockPortfolioClient(
            createEntryResult: .success(listEntries[0]),
            updateEntryResult: .success(listEntries[0]),
            listEntriesResult: .success(listEntries),
        )
        let portfolio = KowalskiPortfolio.testing(client: .testing(portfolio: portfolioClient))

        try await portfolio.fetchEntries().get()
        await portfolio.fetchNetWorth(preferredCurrency: .EUR)
        let netWorth = try #require(portfolio.netWorth)

        #expect(abs(netWorth - 150) < 0.0001)
    }

    @Test
    func `Forex latest request log path should match the shared app endpoint`() {
        let path = KowalskiPortfolio.forexLatestRequestPath(base: .EUR, symbols: [.USD, .GBP])

        #expect(path == "/app-api/forex/latest?base=EUR&symbols=GBP,USD")
    }

    @Test
    func `Forex latest response log body should summarize returned currencies`() {
        let body = KowalskiPortfolio.forexLatestResponseBody(
            ExchangeRates(base: .EUR, date: .now, rates: [.USD: 1.0666, .GBP: 0.88693]),
        )

        #expect(body == "{base: EUR, rateCount: 2, currencies: [GBP,USD]}")
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

    @Test
    func `Empty form values should default to USD when no preferred currency is given`() {
        let formValues = KowalskiPortfolioTransactionFormValues.empty()

        #expect(formValues.purchasePriceCurrency == .USD)
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
    func `Paired create should use the given preferred currency for purchase price`() {
        let entry = makePortfolioEntry(
            stock: makeAppleStock(),
            amount: 5,
            transactionType: .purchase,
        )

        let formValues = KowalskiPortfolioTransactionFormValues.pairedCreate(
            from: entry,
            transactionType: .sell,
            preferredCurrency: .GBP,
        )

        #expect(formValues.purchasePriceCurrency == .GBP)
        #expect(formValues.selectedStock?.symbol == "AAPL")
        #expect(formValues.amount == "5")
        #expect(formValues.transactionType == .sell)
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

private func makePortfolioEntryResponse(
    stock: KowalskiClientStockItem,
    amount: Double,
    purchasePrice: KowalskiClientMoney,
    transactionType: KowalskiClientPortfolioTransactionTypes,
) -> KowalskiPortfolioClientEntryResponse {
    KowalskiPortfolioClientEntryResponse(
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

private func makeMockForexKitConfiguration(responseBody: String) -> ForexKitConfiguration {
    let sessionConfiguration = URLSessionConfiguration.ephemeral
    sessionConfiguration.protocolClasses = [MockForexURLProtocol.self]
    let urlSession = URLSession(configuration: sessionConfiguration)
    MockForexURLProtocol.setHandler { request in
        guard let url = request.url else { throw MockForexURLProtocolError.missingURL }
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil) else {
            throw MockForexURLProtocolError.invalidResponse
        }

        return (response, Data(responseBody.utf8))
    }

    return KowalskiServerConfiguration.defaultForexKitConfiguration(urlSession: urlSession, skipCaching: true)
}

private enum MockForexURLProtocolError: Error {
    case invalidResponse
    case missingHandler
    case missingURL
}

private final class MockForexURLProtocolStore: @unchecked Sendable {
    private let lock = NSLock()
    private var handler: (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

    func setHandler(_ handler: @escaping @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)) {
        lock.lock()
        defer { lock.unlock() }

        self.handler = handler
    }

    func response(for request: URLRequest) throws -> (HTTPURLResponse, Data) {
        lock.lock()
        let handler = handler
        lock.unlock()

        guard let handler else { throw MockForexURLProtocolError.missingHandler }
        return try handler(request)
    }
}

private final class MockForexURLProtocol: URLProtocol {
    private static let store = MockForexURLProtocolStore()

    static func setHandler(_ handler: @escaping @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)) {
        store.setHandler(handler)
    }

    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.path == "/app-api/forex/latest"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        do {
            let (response, data) = try Self.store.response(for: request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private let mixedCurrencyForexResponseBody = """
{
    "base": "EUR",
    "date": "2022-12-30",
    "rates": {
        "USD": 1.0666,
        "GBP": 0.88693
    }
}
"""

private let wrongBaseForexResponseBody = """
{
    "base": "USD",
    "date": "2022-12-30",
    "rates": {
        "GBP": 0.75
    }
}
"""

private let missingRateForexResponseBody = """
{
    "base": "EUR",
    "date": "2022-12-30",
    "rates": {
        "USD": 1.0666
    }
}
"""
