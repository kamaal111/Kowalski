//
//  KowalskiPortfolio.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import CryptoKit
import Foundation
import KamaalExtensions
import KamaalLogger
import KamaalUtils
import KowalskiClient
import KowalskiFeaturesConfig
import KowalskiUtils
import Observation

private let logger = KamaalLogger(from: KowalskiPortfolio.self, failOnError: false)
private let moneyVisibilityPreferenceKey = "\(ModuleConfig.identifier).moneyVisibilityPreference"
private let dashboardPeriodPreferenceKey = "\(ModuleConfig.identifier).dashboardPeriodPreference"
private let dashboardTabPreferenceKey = "\(ModuleConfig.identifier).dashboardTabPreference"
private let cachedPortfolioSnapshotKey = "\(ModuleConfig.identifier).cachedPortfolioSnapshot"
private let fallbackPreflightPollMs = 500
private let maxPreflightPollAttempts = 8

@Observable
@MainActor
public final class KowalskiPortfolio {
    private let client: KowalskiClient
    private let dashboardCache: PortfolioDashboardCache
    private let forceColdStartLoading: Bool
    private let mapper = KowalskiPortfolioMappers()

    private(set) var entries: [PortfolioEntry] = []
    private(set) var holdings: [PortfolioHolding] = []
    private(set) var netWorth: Money?
    private(set) var allTimeProfit: AllTimeProfit?
    private(set) var dashboards: PortfolioDashboards?
    private(set) var showsMoneyValues = true
    private(set) var dashboardPeriod: KowalskiPortfolioDashboardPeriod = .oneYear
    private(set) var selectedDashboardTab: KowalskiPortfolioDashboardTab = .progress
    private(set) var isRefreshingStaleDashboards = false

    private var isLoading = false
    private var isRefreshingLatestPrices = false
    private var isLoadingDashboards = false
    private var hasHydratedCachedSnapshot = false
    private var hasCompletedInitialPortfolioBootstrap = false

    @UserDefaultsValue(key: moneyVisibilityPreferenceKey)
    private static var moneyVisibilityPreference: Bool?

    @UserDefaultsValue(key: dashboardPeriodPreferenceKey)
    private static var dashboardPeriodPreference: String?

    @UserDefaultsValue(key: dashboardTabPreferenceKey)
    private static var dashboardTabPreference: String?

    @UserDefaultsObject(key: cachedPortfolioSnapshotKey)
    private static var cachedSnapshot: CachedPortfolioSnapshot?

    private var activeSnapshotSessionEmail: String?
    private var activeSnapshotCurrencyCode: String?

    var allTimeProfitPercentage: Double? {
        allTimeProfit?.percentage
    }

    var isShowingInitialLoadingState: Bool {
        !hasHydratedCachedSnapshot &&
            entries.isEmpty &&
            holdings.isEmpty &&
            (!hasCompletedInitialPortfolioBootstrap || isLoading)
    }

    var isShowingEmptyState: Bool {
        entries.isEmpty && holdings.isEmpty
    }

    var isShowingLatestPricesRefreshHint: Bool {
        isRefreshingLatestPrices
    }

    var isShowingNetWorthLoadingState: Bool {
        isLoading && !entries.isEmpty && netWorth == nil
    }

    var isLoadingDashboardData: Bool {
        isLoadingDashboards
    }

    var isShowingDashboardLoadingState: Bool {
        isLoadingDashboards && dashboards == nil
    }

    var isShowingDashboardRefreshHint: Bool {
        isRefreshingStaleDashboards
    }

    var isShowingDashboardEmptyState: Bool {
        dashboards?.portfolioGrowthOverTime.points.isEmpty ?? false
    }

    private init(
        client: KowalskiClient,
        dashboardCache: PortfolioDashboardCache? = nil,
        forceColdStartLoading: Bool = KowalskiEnvironment.shouldForcePortfolioColdStartLoading,
    ) {
        self.client = client
        self.dashboardCache = dashboardCache ?? PortfolioDashboardCache()
        self.forceColdStartLoading = forceColdStartLoading
        showsMoneyValues = Self.moneyVisibilityPreference ?? true
        dashboardPeriod = Self.persistedDashboardPeriod
        selectedDashboardTab = Self.persistedDashboardTab
    }

    @MainActor
    func storeTransaction(_ payload: TransactionPayload) async -> Result<Void, StoreTransactionErrors> {
        let payload = mapper.mapTransactionPayloadToCreateEntryPayload(payload)
        let createEntryResult = await client.portfolio.createEntry(payload: payload)
        switch createEntryResult {
        case let .failure(failure):
            switch failure {
            case let .badRequest(_, validations):
                return .failure(.badRequest(validations: validations))
            case .internalServerError, .notFound, .unauthorized, .unknown:
                return .failure(.unknown)
            }
        case .success: break
        }

        let fetchOverviewResult = await refreshPortfolio()
        switch fetchOverviewResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh portfolio after create", error: failure)
        case .success: break
        }

        return .success(())
    }

    func updateTransaction(
        _ payload: TransactionPayload,
        entryId: String,
    ) async -> Result<PortfolioEntry, UpdateTransactionErrors> {
        let payload = mapper.mapTransactionPayloadToCreateEntryPayload(payload)
        let updateEntryResult = await client.portfolio.updateEntry(entryId: entryId, payload: payload)
        switch updateEntryResult {
        case let .failure(failure):
            switch failure {
            case let .badRequest(_, validations):
                return .failure(.badRequest(validations: validations))
            case .internalServerError, .notFound, .unauthorized, .unknown:
                return .failure(.unknown)
            }
        case .success: break
        }

        let fetchOverviewResult = await refreshPortfolio()
        switch fetchOverviewResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh portfolio after update", error: failure)
        case .success:
            guard let updatedEntry = entries.find(by: \.id, is: entryId) else {
                logger.error("Updated entry missing from refreshed entries")
                return .failure(.unknown)
            }

            return .success(updatedEntry)
        }

        return .failure(.unknown)
    }

    public func exportTransactions() async -> Result<URL, ExportTransactionErrors> {
        switch PortfolioTransactionsCSV.export(entries: entries) {
        case let .success(url): .success(url)
        case .failure: .failure(.unknown)
        }
    }

    public func downloadTransactionsTemplate() async -> Result<URL, ExportTransactionErrors> {
        switch PortfolioTransactionsCSV.exportTemplate() {
        case let .success(url): .success(url)
        case .failure: .failure(.unknown)
        }
    }

    public func importTransactions(from url: URL) async -> Result<Void, ImportTransactionErrors> {
        let parsedCSV: PortfolioTransactionsCSVImportResult
        switch PortfolioTransactionsCSV.import(from: url) {
        case let .success(success):
            parsedCSV = success
        case let .failure(error):
            switch error {
            case .invalidFormat:
                return .failure(.invalidFormat)
            case .readFailed, .writeFailed:
                break
            }

            return .failure(.unknown)
        }

        let bulkCreateResult = await client.portfolio.bulkCreateEntries(entries: parsedCSV.entries)
        let importedEntries: [KowalskiPortfolioClientEntryResponse]
        switch bulkCreateResult {
        case let .failure(failure):
            logger.error(label: "Failed to import transactions from CSV", error: failure)
            return .failure(.unknown)
        case let .success(success):
            importedEntries = success
        }

        let refreshOverviewResult = await refreshPortfolio()
        switch refreshOverviewResult {
        case let .failure(failure):
            logger.error(label: "Failed to refresh portfolio after import", error: failure)
            return .failure(.unknown)
        case .success:
            logger.info("Imported \(importedEntries.count) transactions from CSV")
            return .success(())
        }
    }

    @MainActor
    func searchStocks(query: String) async -> Result<[Stock], Error> {
        let result = await client.stocks.search(query: query)

        return result.map(mapper.mapStocksSearchResponse)
            .mapError { error in error as Error }
    }

    func bootstrapPortfolio(sessionEmail: String?, currencyCode: String) async -> Result<Void, Error> {
        activeSnapshotSessionEmail = sessionEmail
        activeSnapshotCurrencyCode = currencyCode
        let hydratedSnapshot = if forceColdStartLoading {
            false
        } else {
            hydrateCachedSnapshotIfAvailable(sessionEmail: sessionEmail, currencyCode: currencyCode)
        }
        if !hydratedSnapshot {
            isLoading = true
        }
        defer {
            isLoading = false
            hasCompletedInitialPortfolioBootstrap = true
        }

        let preflightResult = await client.portfolio.getOverviewPreflight()
        let preflight: KowalskiPortfolioOverviewPreflightResponse
        switch preflightResult {
        case let .success(success):
            preflight = success
        case let .failure(error):
            logger.error(label: "Failed to preflight portfolio overview", error: error)
            if hydratedSnapshot {
                return await refreshFromServer(sessionEmail: sessionEmail, currencyCode: currencyCode)
            }

            return await refreshFromServer(sessionEmail: sessionEmail, currencyCode: currencyCode)
        }

        switch preflight.refreshState {
        case .ready:
            isRefreshingLatestPrices = false
            return await refreshFromServer(sessionEmail: sessionEmail, currencyCode: currencyCode)
        case .refreshing:
            isRefreshingLatestPrices = true
            _ = await waitUntilHoldingsReady()
            let refreshResult = await refreshFromServer(sessionEmail: sessionEmail, currencyCode: currencyCode)
            isRefreshingLatestPrices = false

            return refreshResult
        }
    }

    func fetchOverview() async -> Result<Void, Error> {
        await withLoading { await refreshFromServer() }
    }

    func fetchDashboards() async -> Result<Void, Error> {
        let transactionHash = makeTransactionsHash(entries)
        let cacheScope = dashboardCacheScope()
        let cachedDashboard = dashboardCache.read(
            sessionEmail: cacheScope.sessionEmail,
            currencyCode: cacheScope.currencyCode,
            period: dashboardPeriod,
        )
        if let cachedDashboard {
            setDashboards(cachedDashboard.dashboards)
            guard cachedDashboard.transactionHash != transactionHash else { return .success(()) }

            return await refreshDashboards(
                transactionHash: transactionHash,
                cacheScope: cacheScope,
                refreshesStaleCache: true,
            )
        }

        clearDashboards()

        return await refreshDashboards(
            transactionHash: transactionHash,
            cacheScope: cacheScope,
            refreshesStaleCache: false,
        )
    }

    func toggleMoneyVisibility() {
        setMoneyVisibility(!showsMoneyValues)
    }

    func setDashboardPeriod(_ period: KowalskiPortfolioDashboardPeriod) async -> Result<Void, Error> {
        guard dashboardPeriod != period else { return .success(()) }

        setDashboardPeriodPreference(period)
        return await fetchDashboards()
    }

    func setDashboardTab(_ tab: KowalskiPortfolioDashboardTab) {
        guard selectedDashboardTab != tab else { return }

        selectedDashboardTab = tab
        Self.dashboardTabPreference = tab.rawValue
    }

    private func computeAllTimeProfit(
        for entries: [PortfolioEntry],
        netWorth: Money,
    ) -> AllTimeProfit? {
        let netHoldings = computeNetHoldings(for: entries)
        guard netHoldings.values.contains(where: { $0 != 0 }) else { return nil }

        var costBasis = 0.0
        for entry in entries {
            let costBasisMoney = entry.preferredCurrencyPurchasePrice
            guard costBasisMoney.currency == netWorth.currency else {
                logger.warning("Portfolio cost basis should use a consistent currency")
                return nil
            }

            let costBasisDelta = entry.amount * costBasisMoney.value
            switch entry.transactionType {
            case .purchase:
                costBasis += costBasisDelta
            case .sell:
                costBasis -= costBasisDelta
            case .split:
                continue
            }
        }

        let profitValue = netWorth.value - costBasis
        let profitPercentage: Double? = if costBasis == 0 {
            nil
        } else {
            (profitValue / costBasis) * 100
        }

        return AllTimeProfit(
            profit: Money(currency: netWorth.currency, value: profitValue),
            percentage: profitPercentage,
        )
    }

    // MARK: Helpers

    private func computeNetHoldings(for entries: [PortfolioEntry]) -> [String: Double] {
        entries.reduce([String: Double]()) { holdings, entry in
            let amountDelta: Double = switch entry.transactionType {
            case .purchase: entry.amount
            case .sell: -entry.amount
            case .split: 0
            }

            var holdings = holdings
            holdings[entry.stock.symbol, default: 0] += amountDelta

            return holdings
        }
    }

    @MainActor
    private func setEntries(_ newEntries: [PortfolioEntry]) {
        entries = newEntries
    }

    @MainActor
    private func setHoldings(_ newHoldings: [PortfolioHolding]) {
        holdings = newHoldings
    }

    @MainActor
    private func setNetWorth(_ newNetWorth: Money?) {
        netWorth = newNetWorth
    }

    @MainActor
    private func setAllTimeProfit(_ profit: AllTimeProfit?) {
        allTimeProfit = profit
    }

    @MainActor
    private func setDashboards(_ dashboards: PortfolioDashboards) {
        self.dashboards = dashboards
    }

    @MainActor
    private func clearDashboards() {
        dashboards = nil
    }

    @MainActor
    private func setDashboardRefreshHint(_ isVisible: Bool) {
        isRefreshingStaleDashboards = isVisible
    }

    @MainActor
    private func setMoneyVisibility(_ showsMoneyValues: Bool) {
        self.showsMoneyValues = showsMoneyValues
        Self.moneyVisibilityPreference = showsMoneyValues
    }

    @MainActor
    private func setDashboardPeriodPreference(_ period: KowalskiPortfolioDashboardPeriod) {
        dashboardPeriod = period
        Self.dashboardPeriodPreference = period.rawValue
    }

    @MainActor
    private func withLoading<T>(_ block: () async -> T) async -> T {
        isLoading = true
        let result = await block()
        isLoading = false

        return result
    }

    @MainActor
    private func withDashboardLoading<T>(_ block: () async -> T) async -> T {
        isLoadingDashboards = true
        let result = await block()
        isLoadingDashboards = false

        return result
    }
}

// MARK: Factory

public extension KowalskiPortfolio {
    static func forEnvironment() -> KowalskiPortfolio {
        guard KowalskiEnvironment.isUiTesting else { return `default`() }
        if KowalskiEnvironment.shouldResetPortfolioMoneyVisibility {
            resetPersistedMoneyVisibility()
        }
        guard let scenario = KowalskiEnvironment.portfolioUiTestScenario else { return preview() }

        switch scenario {
        case .entries:
            return listEntriesPreview()
        case .createSequence:
            return createEntrySequencePreview()
        case .listFailure:
            return overviewFailingPreview()
        }
    }

    static func `default`() -> KowalskiPortfolio {
        let client = KowalskiClient.default()

        return KowalskiPortfolio(client: client)
    }

    static func preview() -> KowalskiPortfolio {
        let client = KowalskiClient.preview(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    static func createEntryFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioCreateEntry(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    static func createEntryValidationFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithValidationFailingPortfolioCreateEntry(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    private static func createEntrySequencePreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioCreateSequence(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    private static func listEntriesPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithPortfolioEntries(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    static func overviewFailingPreview() -> KowalskiPortfolio {
        let client = KowalskiClient.previewWithFailingPortfolioListEntries(withCredentials: true)

        return KowalskiPortfolio(client: client)
    }

    static func testing(
        client: KowalskiClient,
        dashboardCacheDirectoryURL: URL? = nil,
        forceColdStartLoading: Bool = false,
    ) -> KowalskiPortfolio {
        let dashboardCacheDirectoryURL = dashboardCacheDirectoryURL ?? FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let dashboardCache = PortfolioDashboardCache(directoryURL: dashboardCacheDirectoryURL)

        return KowalskiPortfolio(
            client: client,
            dashboardCache: dashboardCache,
            forceColdStartLoading: forceColdStartLoading,
        )
    }
}

extension KowalskiPortfolio {
    static func resetPersistedMoneyVisibility() {
        _moneyVisibilityPreference.removeValue()
    }

    static func resetPersistedDashboardPeriod() {
        _dashboardPeriodPreference.removeValue()
    }

    static func resetPersistedDashboardTab() {
        _dashboardTabPreference.removeValue()
    }

    static func resetPersistedSnapshot() {
        _cachedSnapshot.removeValue()
    }
}

private extension KowalskiPortfolio {
    static var persistedDashboardPeriod: KowalskiPortfolioDashboardPeriod {
        guard let rawValue = dashboardPeriodPreference else { return .oneYear }

        return KowalskiPortfolioDashboardPeriod(rawValue: rawValue) ?? .oneYear
    }

    static var persistedDashboardTab: KowalskiPortfolioDashboardTab {
        guard let rawValue = dashboardTabPreference else { return .progress }

        return KowalskiPortfolioDashboardTab(rawValue: rawValue) ?? .progress
    }

    func refreshPortfolio() async -> Result<Void, Error> {
        await refreshFromServer(sessionEmail: activeSnapshotSessionEmail, currencyCode: activeSnapshotCurrencyCode)
    }

    func refreshFromServer(sessionEmail: String? = nil, currencyCode: String? = nil) async -> Result<Void, Error> {
        let overviewResult = await client.portfolio.getOverview()
            .map(mapper.mapOverviewResponse)
        let overviewState: PortfolioOverviewState
        switch overviewResult {
        case let .failure(error): return .failure(error)
        case let .success(success): overviewState = success
        }

        let profitResult = computeAllTimeProfit(for: overviewState.entries, netWorth: overviewState.netWorth)
        setHoldings(overviewState.holdings)
        setEntries(overviewState.entries)
        setNetWorth(overviewState.netWorth)
        setAllTimeProfit(profitResult)
        persistCachedSnapshot(sessionEmail: sessionEmail, currencyCode: currencyCode)

        return .success(())
    }

    func refreshDashboards(
        transactionHash: String,
        cacheScope: DashboardCacheScope,
        refreshesStaleCache: Bool,
    ) async -> Result<Void, Error> {
        setDashboardRefreshHint(refreshesStaleCache)
        defer { setDashboardRefreshHint(false) }

        return await withDashboardLoading {
            let dashboardsResult = await client.portfolio.getDashboards(period: dashboardPeriod)
                .map(mapper.mapDashboardsResponse)
            let dashboards: PortfolioDashboards
            switch dashboardsResult {
            case let .failure(error):
                logger.error("Failed to fetch portfolio dashboards: \(error.localizedDescription)")
                return .failure(error)
            case let .success(success):
                dashboards = success
            }

            setDashboards(dashboards)
            persistCachedDashboard(
                dashboards,
                transactionHash: transactionHash,
                cacheScope: cacheScope,
            )

            return .success(())
        }
    }

    func waitUntilHoldingsReady() async -> Result<Void, Error> {
        for _ in 0 ..< maxPreflightPollAttempts {
            let preflightResult = await client.portfolio.getOverviewPreflight()
            switch preflightResult {
            case let .failure(error):
                return .failure(error)
            case let .success(preflight):
                if preflight.refreshState == .ready {
                    return .success(())
                }

                let pollAfterMilliseconds = preflight.pollAfterMilliseconds ?? fallbackPreflightPollMs
                try? await Task.sleep(for: .milliseconds(pollAfterMilliseconds))
            }
        }

        return .success(())
    }

    @discardableResult
    func hydrateCachedSnapshotIfAvailable(sessionEmail: String?, currencyCode: String) -> Bool {
        guard let cachedSnapshot = Self.cachedSnapshot else {
            hasHydratedCachedSnapshot = false
            return false
        }

        let shouldHydrate = cachedSnapshot.sessionEmail == cacheSessionEmail(sessionEmail) &&
            cachedSnapshot.currencyCode == currencyCode
        guard shouldHydrate else {
            clearCachedSnapshotIfScopeMismatches(sessionEmail: sessionEmail, currencyCode: currencyCode)
            hasHydratedCachedSnapshot = false
            return false
        }

        setEntries(cachedSnapshot.entries)
        setHoldings(cachedSnapshot.holdings)
        setNetWorth(cachedSnapshot.netWorth)
        if let netWorth = cachedSnapshot.netWorth {
            setAllTimeProfit(computeAllTimeProfit(for: cachedSnapshot.entries, netWorth: netWorth))
        } else {
            setAllTimeProfit(nil)
        }
        hasHydratedCachedSnapshot = true

        return true
    }

    func persistCachedSnapshot(sessionEmail: String?, currencyCode: String?) {
        guard let currencyCode else { return }

        Self.cachedSnapshot = CachedPortfolioSnapshot(
            sessionEmail: cacheSessionEmail(sessionEmail),
            currencyCode: currencyCode,
            entries: entries,
            holdings: holdings,
            netWorth: netWorth,
            cachedAt: .now,
        )
    }

    func clearCachedSnapshotIfScopeMismatches(sessionEmail: String?, currencyCode: String) {
        guard let cachedSnapshot = Self.cachedSnapshot else { return }

        let shouldReset = cachedSnapshot.sessionEmail != cacheSessionEmail(sessionEmail) ||
            cachedSnapshot.currencyCode != currencyCode
        guard shouldReset else { return }

        Self.resetPersistedSnapshot()
    }

    func cacheSessionEmail(_ sessionEmail: String?) -> String {
        sessionEmail ?? ""
    }

    func dashboardCacheScope() -> DashboardCacheScope {
        let currencyCode = activeSnapshotCurrencyCode
            ?? netWorth?.currency.rawValue
            ?? KowalskiFeatureDefaults.fallbackCurrency.rawValue

        return DashboardCacheScope(
            sessionEmail: cacheSessionEmail(activeSnapshotSessionEmail),
            currencyCode: currencyCode,
        )
    }

    func persistCachedDashboard(
        _ dashboards: PortfolioDashboards,
        transactionHash: String,
        cacheScope: DashboardCacheScope,
    ) {
        do {
            try dashboardCache.write(
                CachedPortfolioDashboard(
                    sessionEmail: cacheScope.sessionEmail,
                    currencyCode: cacheScope.currencyCode,
                    period: dashboardPeriod,
                    transactionHash: transactionHash,
                    dashboards: dashboards,
                    cachedAt: .now,
                ),
            )
        } catch {
            logger.warning("Failed to persist portfolio dashboard cache")
        }
    }

    func makeTransactionsHash(_ entries: [PortfolioEntry]) -> String {
        let canonicalEntries = entries
            .sorted { first, second in
                if first.id == second.id {
                    return first.updatedAt < second.updatedAt
                }

                return first.id < second.id
            }
            .map(CanonicalTransaction.fromEntry(_:))
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        let data: Data
        do {
            data = try encoder.encode(canonicalEntries)
        } catch {
            logger.error(label: "Failed to encode canonical transactions for portfolio hash", error: error)
            data = Data()
        }

        return SHA256.hash(data: data).hexString
    }
}

private struct DashboardCacheScope {
    let sessionEmail: String
    let currencyCode: String
}

private struct CanonicalTransaction: Encodable {
    let id: String
    let updatedAt: Date
    let stockSymbol: String
    let stockExchange: String
    let stockName: String
    let stockISIN: String?
    let amount: Double
    let purchasePriceCurrency: String
    let purchasePriceValue: Double
    let preferredCurrencyPurchasePriceCurrency: String
    let preferredCurrencyPurchasePriceValue: Double
    let transactionType: String
    let transactionDate: Date

    static func fromEntry(_ entry: PortfolioEntry) -> CanonicalTransaction {
        CanonicalTransaction(
            id: entry.id,
            updatedAt: entry.updatedAt,
            stockSymbol: entry.stock.symbol,
            stockExchange: entry.stock.exchange,
            stockName: entry.stock.name,
            stockISIN: entry.stock.isin,
            amount: entry.amount,
            purchasePriceCurrency: entry.purchasePrice.currency.rawValue,
            purchasePriceValue: entry.purchasePrice.value,
            preferredCurrencyPurchasePriceCurrency: entry.preferredCurrencyPurchasePrice.currency.rawValue,
            preferredCurrencyPurchasePriceValue: entry.preferredCurrencyPurchasePrice.value,
            transactionType: entry.transactionType.cacheValue,
            transactionDate: entry.transactionDate,
        )
    }
}

// - MARK: Errors

enum StoreTransactionErrors: Error, Equatable, LocalizedError {
    case unknown
    case badRequest(validations: [KowalskiClientValidationIssue])

    var errorDescription: String? {
        switch self {
        case .unknown: NSLocalizedString("Failed to add transaction", comment: "")
        case let .badRequest(validations):
            validationErrorMessage(
                validations,
                fallback: NSLocalizedString("Invalid information provided", comment: ""),
            )
        }
    }
}

enum UpdateTransactionErrors: Error, Equatable, LocalizedError {
    case unknown
    case badRequest(validations: [KowalskiClientValidationIssue])

    var errorDescription: String? {
        switch self {
        case .unknown: NSLocalizedString("Failed to update transaction", comment: "")
        case let .badRequest(validations):
            validationErrorMessage(
                validations,
                fallback: NSLocalizedString("Invalid information provided", comment: ""),
            )
        }
    }
}

public enum ExportTransactionErrors: Error, Equatable, LocalizedError {
    case unknown

    public var errorDescription: String? {
        switch self {
        case .unknown:
            NSLocalizedString("Failed to export transactions", comment: "")
        }
    }
}

public enum ImportTransactionErrors: Error, Equatable, LocalizedError {
    case invalidFormat
    case unknown

    public var errorDescription: String? {
        switch self {
        case .invalidFormat:
            NSLocalizedString("The CSV file is missing required transaction columns.", comment: "")
        case .unknown:
            NSLocalizedString("Failed to import transactions", comment: "")
        }
    }
}

private func validationErrorMessage(_ validations: [KowalskiClientValidationIssue], fallback: String) -> String {
    guard let firstValidation = validations.first else { return fallback }
    guard let field = firstValidation.displayPath else { return fallback }

    return "\(field): \(firstValidation.message)"
}
