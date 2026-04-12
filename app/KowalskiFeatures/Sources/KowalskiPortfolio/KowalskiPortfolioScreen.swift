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
            if portfolio.isLoading, portfolio.entries.isEmpty {
                ProgressView("Loading entries")
            } else if portfolio.entries.isEmpty {
                emptyState
            } else {
                content
            }
        }
        .ktakeSizeEagerly(alignment: .topLeading)
        .toolbar {
            ToolbarItem(placement: .automatic) {
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
            entriesList
        }
    }

    private var entriesList: some View {
        List(portfolio.entries) { entry in
            NavigationLink(destination: {
                KowalskiPortfolioTransactionDetailScreen(entry: entry)
            }) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(entry.stock.symbol)
                            .font(.headline)
                        Text(entry.stock.name)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text(entry.transactionType.label)
                        Spacer()
                        Text("\(entry.amount.formatted(.number)) shares")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    Text(entry.transactionDate.formatted(.dateTime.year().month().day()))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, .extraSmall)
            }
            .accessibilityLabel(Text(entry.stock.name))
        }
        .listStyle(.inset)
    }

    private var netWorthCard: some View {
        HStack(alignment: .top, spacing: KowalskiSizes.medium.rawValue) {
            VStack(alignment: .leading, spacing: KowalskiSizes.small.rawValue) {
                Text("Holdings Net Worth")
                    .font(.headline)
                if portfolio.isLoading, !portfolio.entries.isEmpty, portfolio.netWorth == nil {
                    ProgressView("Loading net worth")
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
            .frame(maxWidth: .infinity, alignment: .leading)

            if portfolio.allTimeProfit != nil {
                profitView
            }
        }
        .padding(.horizontal, .medium)
        .padding(.vertical, .medium)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.all, .medium)
    }

    private var profitView: some View {
        VStack(alignment: .trailing, spacing: KowalskiSizes.extraSmall.rawValue) {
            Text("All-Time Profit")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(formattedAllTimeProfit)
                .font(.headline.weight(.semibold))
            if let formattedAllTimeProfitPercentage {
                Text(formattedAllTimeProfitPercentage)
                    .font(.caption)
            }
        }
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

    private var displayedNetWorthCurrency: Currencies {
        portfolio.netWorth?.currency ?? auth.effectiveCurrency
    }

    private var allTimeProfitColor: Color {
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
        guard let allTimeProfit = portfolio.allTimeProfit else { return "" }

        return formattedSignedCurrency(
            value: allTimeProfit.value,
            currency: allTimeProfit.currency,
        )
    }

    private var formattedAllTimeProfitPercentage: String? {
        guard let allTimeProfitPercentage = portfolio.allTimeProfitPercentage else { return nil }

        return "(\(formattedSignedPercent(allTimeProfitPercentage)))"
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
