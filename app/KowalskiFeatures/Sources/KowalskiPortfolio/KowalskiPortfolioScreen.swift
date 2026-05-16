//
//  KowalskiPortfolioScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import ForexKit
import KamaalUI
import KowalskiAuth
import KowalskiDesignSystem
import SwiftUI

public struct KowalskiPortfolioScreen: View {
    @Environment(KowalskiAuth.self) private var auth
    @Environment(KowalskiPortfolio.self) private var portfolio

    @State private var hasLoadedEntries = false
    @State private var toast: Toast?

    public init() {}

    public var body: some View {
        KJustStack {
            if portfolio.isLoading, portfolio.entries.isEmpty, portfolio.holdings.isEmpty {
                loadingState
            } else if portfolio.entries.isEmpty, portfolio.holdings.isEmpty {
                emptyState
            } else {
                content
            }
        }
        .ktakeSizeEagerly(alignment: .topLeading)
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                Button {
                    portfolio.toggleMoneyVisibility()
                } label: {
                    Image(systemName: portfolio.showsMoneyValues ? "eye" : "eye.slash")
                }
                .accessibilityLabel(Text(moneyVisibilityAccessibilityLabel))

                NavigationLink(destination: {
                    KowalskiPortfolioTransactionScreen(onTransactionAdd: { payload in
                        toast = .success(
                            message: String(localized: "\(payload.stock.name) entry added"),
                        )
                    })
                }) {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(Text("Add entry"))
            }
        }
        .frame(minSize: ModuleConfig.screenMinSize)
        .navigationTitle("My Portfolio")
        .task {
            guard !hasLoadedEntries else { return }

            hasLoadedEntries = true
            await handleFetchOverview()
        }
        .onChange(of: auth.effectiveCurrency) { _, _ in
            guard hasLoadedEntries else { return }

            Task {
                await handleFetchOverview()
            }
        }
        .toastView(toast: $toast)
    }

    private var content: some View {
        VStack(spacing: KowalskiSizes.medium.rawValue) {
            netWorthCard
            holdingsList
        }
    }

    private var holdingsList: some View {
        List(portfolio.holdings, id: \.self) { holding in
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(holding.asset.symbol)
                        .font(.headline)
                    Text(holding.asset.name)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text("\(holding.amount.formatted(.number)) shares")
                    Spacer()
                    if portfolio.showsMoneyValues {
                        Text(holding.totalValue.value, format: .currency(code: holding.totalValue.currency.rawValue))
                    } else {
                        Text(PortfolioMoneyValuePrivacy.maskedPlaceholder)
                            .accessibilityIdentifier(PortfolioMoneyValuePrivacy.accessibilityIdentifier)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                if portfolio.showsMoneyValues {
                    Text(
                        "Unit \(holding.unitValue.value, format: .currency(code: holding.unitValue.currency.rawValue))",
                    )
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                }
            }
            .padding(.vertical, .extraSmall)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text("\(holding.asset.name), \(holding.amount.formatted(.number)) shares"))
            .accessibilityIdentifier("portfolio-holding-\(holding.asset.name)")
        }
        .listStyle(.inset)
    }

    private var netWorthCard: some View {
        NavigationLink(destination: {
            KowalskiPortfolioTransactionsScreen()
        }) {
            HStack(alignment: .top, spacing: KowalskiSizes.medium.rawValue) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Holdings Net Worth")
                        .font(.headline)
                    if portfolio.isLoading, !portfolio.entries.isEmpty, portfolio.netWorth == nil {
                        ProgressView("Loading net worth")
                    } else if !portfolio.showsMoneyValues, portfolio.netWorth != nil {
                        Text(PortfolioMoneyValuePrivacy.maskedPlaceholder)
                            .font(.largeTitle.weight(.semibold))
                            .accessibilityLabel(Text(PortfolioMoneyValuePrivacy.maskedPlaceholder))
                            .accessibilityIdentifier(PortfolioMoneyValuePrivacy.accessibilityIdentifier)
                        Text(displayedNetWorthCurrency.localized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if let netWorth = portfolio.netWorth?.value {
                        Text(netWorth, format: .currency(code: displayedNetWorthCurrency.rawValue))
                            .font(.largeTitle.weight(.semibold))
                        Text(displayedNetWorthCurrency.localized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Net worth unavailable")
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .contain)
                .frame(maxWidth: .infinity, alignment: .leading)

                if portfolio.allTimeProfit != nil {
                    profitView
                }
            }
            .padding(.horizontal, .medium)
            .padding(.vertical, .medium)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("View transactions"))
        .padding(.all, .medium)
    }

    private var profitView: some View {
        VStack(alignment: .trailing, spacing: KowalskiSizes.extraSmall.rawValue) {
            Text("All-Time Profit")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(formattedAllTimeProfit)
                .font(.headline.weight(.semibold))
                .accessibilityLabel(Text(formattedAllTimeProfit))
                .accessibilityIdentifier(
                    portfolio.showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier,
                )
            Text(formattedAllTimeProfitPercentage)
                .font(.caption)
                .accessibilityLabel(Text(formattedAllTimeProfitPercentage))
                .accessibilityIdentifier(
                    portfolio.showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier,
                )
        }
        .accessibilityElement(children: .contain)
        .foregroundStyle(allTimeProfitColor)
        .multilineTextAlignment(.trailing)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Text("No portfolio entries yet")
                .font(.title3)
            Text("Use the add button to record your first stock transaction.")
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
        .padding(.all, .medium)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private var loadingState: some View {
        VStack(spacing: KowalskiSizes.medium.rawValue) {
            ProgressView()
                .controlSize(.large)
            Text("Loading your portfolio", bundle: .module)
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private var displayedNetWorthCurrency: Currencies {
        portfolio.netWorth?.currency ?? auth.effectiveCurrency
    }

    private var allTimeProfitColor: Color {
        guard portfolio.showsMoneyValues else { return .secondary }
        guard let allTimeProfit = portfolio.allTimeProfit else { return .secondary }
        if allTimeProfit.value > 0 {
            return .green
        }
        if allTimeProfit.value < 0 {
            return .red
        }

        return .secondary
    }

    private var formattedAllTimeProfit: String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }
        guard let allTimeProfit = portfolio.allTimeProfit else { return "" }

        return formattedSignedCurrency(
            value: allTimeProfit.value,
            currency: allTimeProfit.currency,
        )
    }

    private var formattedAllTimeProfitPercentage: String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }
        guard let allTimeProfitPercentage = portfolio.allTimeProfitPercentage else { return "" }

        return "(\(formattedSignedPercent(allTimeProfitPercentage)))"
    }

    private var moneyVisibilityAccessibilityLabel: String {
        portfolio.showsMoneyValues
            ? NSLocalizedString("Hide money values", bundle: .module, comment: "")
            : NSLocalizedString("Show money values", bundle: .module, comment: "")
    }

    @MainActor
    private func handleFetchOverview() async {
        let result = await portfolio.fetchOverview()
        if case .failure = result {
            toast = .error(message: NSLocalizedString("Failed to load portfolio entries", comment: ""))
        }
    }

    private func formattedSignedCurrency(value: Double, currency: Currencies) -> String {
        let sign = if value > 0 {
            "+"
        } else if value < 0 {
            "-"
        } else {
            ""
        }
        let formattedValue = abs(value).formatted(.currency(code: currency.rawValue))

        return "\(sign)\(formattedValue)"
    }

    private func formattedSignedPercent(_ value: Double) -> String {
        let sign = if value > 0 {
            "+"
        } else if value < 0 {
            "-"
        } else {
            ""
        }
        let formattedValue = (abs(value) / 100).formatted(.percent.precision(.fractionLength(0 ... 1)))

        return "\(sign)\(formattedValue)"
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioScreen()
    }
    .preview()
}
