//
//  KowalskiPortfolioNavigationStack.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/20/26.
//

import KowalskiAuth
import KowalskiDesignSystem
import SwiftUI

enum KowalskiPortfolioNavigationItem: Hashable {
    case portfolio
    case transactions
}

enum KowalskiPortfolioTransactionNavigationItem: Hashable {
    case detail(entryID: String)
    case pairedTransaction(entryID: String, transactionType: TransactionType)
}

enum KowalskiPortfolioNavigationPathItem: Hashable {
    case holding(symbol: String)
    case transactionDetail(entryID: String)
    case holdingTransaction(symbol: String, transactionType: TransactionType)
}

public struct KowalskiPortfolioNavigationStack: View {
    @Environment(KowalskiAuth.self) private var auth
    @Environment(KowalskiPortfolio.self) private var portfolio

    @State private var hasLoadedEntries = false
    @State private var selectedNavigationItem: KowalskiPortfolioNavigationItem? = .portfolio
    @State private var portfolioNavigationPath: [KowalskiPortfolioNavigationPathItem] = []
    @State private var transactionNavigationPath: [KowalskiPortfolioTransactionNavigationItem] = []
    @State private var toast: Toast?

    public init() {}

    public var body: some View {
        NavigationSplitView {
            KowalskiPortfolioSidebar(selectedNavigationItem: $selectedNavigationItem)
        } detail: {
            switch selectedNavigationItem ?? .portfolio {
            case .portfolio:
                NavigationStack(path: $portfolioNavigationPath) {
                    KowalskiPortfolioScreen()
                        .toolbar {
                            portfolioToolbar
                        }
                        .frame(minSize: ModuleConfig.screenMinSize)
                        .toastView(toast: $toast)
                        .navigationDestination(for: KowalskiPortfolioNavigationPathItem.self) { item in
                            switch item {
                            case let .holding(symbol):
                                if let holding = portfolio.holdings.first(where: { $0.asset.symbol == symbol }) {
                                    KowalskiPortfolioHoldingDetailScreen(holding: holding)
                                }
                            case let .transactionDetail(entryID):
                                if let entry = portfolio.entries.first(where: { $0.id == entryID }) {
                                    KowalskiPortfolioTransactionDetailScreen(
                                        entry: entry,
                                        onPairedTransaction: { entry, transactionType in
                                            portfolioNavigationPath.append(
                                                .holdingTransaction(
                                                    symbol: entry.stock.symbol,
                                                    transactionType: transactionType,
                                                ),
                                            )
                                        },
                                    )
                                }
                            case let .holdingTransaction(symbol, transactionType):
                                if let holding = portfolio.holdings.first(where: { $0.asset.symbol == symbol }) {
                                    KowalskiPortfolioTransactionScreen(
                                        initialValues: .holdingCreate(
                                            from: holding,
                                            transactionType: transactionType,
                                            preferredCurrency: auth.effectiveCurrency,
                                        ),
                                        editorConfiguration: .pairedCreate(transactionType: transactionType),
                                        onTransactionAdd: handleTransactionAdd,
                                    )
                                }
                            }
                        }
                }
            case .transactions:
                NavigationStack(path: $transactionNavigationPath) {
                    KowalskiPortfolioTransactionsScreen()
                        .toolbar {
                            portfolioToolbar
                        }
                        .frame(minSize: ModuleConfig.screenMinSize)
                        .toastView(toast: $toast)
                        .navigationDestination(for: KowalskiPortfolioTransactionNavigationItem.self) { item in
                            switch item {
                            case let .detail(entryID):
                                if let entry = portfolio.entries.first(where: { $0.id == entryID }) {
                                    KowalskiPortfolioTransactionDetailScreen(
                                        entry: entry,
                                        onPairedTransaction: { entry, transactionType in
                                            transactionNavigationPath.append(
                                                .pairedTransaction(
                                                    entryID: entry.id,
                                                    transactionType: transactionType,
                                                ),
                                            )
                                        },
                                    )
                                }
                            case let .pairedTransaction(entryID, transactionType):
                                if let entry = portfolio.entries.first(where: { $0.id == entryID }) {
                                    KowalskiPortfolioTransactionScreen(
                                        initialValues: .pairedCreate(from: entry, transactionType: transactionType),
                                        editorConfiguration: .pairedCreate(transactionType: transactionType),
                                        onTransactionAdd: { _ in
                                            DispatchQueue.main.async {
                                                transactionNavigationPath.removeAll()
                                            }
                                        },
                                    )
                                }
                            }
                        }
                }
            }
        }
        .task {
            guard !hasLoadedEntries else { return }

            hasLoadedEntries = true
            await handleBootstrapPortfolio()
        }
        .onChange(of: auth.effectiveCurrency) { _, _ in
            guard hasLoadedEntries else { return }

            Task { await handleBootstrapPortfolio() }
        }
    }

    @ToolbarContentBuilder
    private var portfolioToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .automatic) {
            Button(action: { portfolio.toggleMoneyVisibility() }) {
                Image(systemName: portfolio.showsMoneyValues ? "eye" : "eye.slash")
            }
            .accessibilityLabel(Text(moneyVisibilityAccessibilityLabel))

            NavigationLink(destination: {
                KowalskiPortfolioTransactionScreen(onTransactionAdd: handleTransactionAdd)
            }) {
                Image(systemName: "plus")
            }
            .accessibilityLabel(Text("Add entry"))
        }
    }

    private var moneyVisibilityAccessibilityLabel: String {
        portfolio.showsMoneyValues
            ? NSLocalizedString("Hide money values", bundle: .module, comment: "")
            : NSLocalizedString("Show money values", bundle: .module, comment: "")
    }

    private func handleTransactionAdd(_ payload: TransactionPayload) {
        toast = .success(
            message: String(localized: "\(payload.stock.name) entry added"),
        )
    }

    @MainActor
    private func handleBootstrapPortfolio() async {
        let result = await portfolio.bootstrapPortfolio(
            sessionEmail: auth.session?.email,
            currencyCode: auth.effectiveCurrency.rawValue,
        )
        if case .failure = result {
            toast = .error(message: NSLocalizedString("Failed to load portfolio entries", comment: ""))
        }
    }
}

#Preview {
    KowalskiPortfolioNavigationStack()
        .preview()
}
