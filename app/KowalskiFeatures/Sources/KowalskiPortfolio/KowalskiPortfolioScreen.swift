//
//  KowalskiPortfolioScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

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
            await handleFetchEntries()
        }
        .onChange(of: auth.effectiveCurrency) { _, preferredCurrency in
            guard hasLoadedEntries else { return }

            Task {
                await portfolio.fetchNetWorth(preferredCurrency: preferredCurrency)
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
        VStack(alignment: .leading, spacing: KowalskiSizes.small.rawValue) {
            Text("Net Worth")
                .font(.headline)
            if portfolio.isLoadingNetWorth {
                ProgressView("Loading net worth")
            } else if let netWorth = portfolio.netWorth {
                Text(netWorth, format: .currency(code: auth.effectiveCurrency.rawValue))
                    .font(.largeTitle.weight(.semibold))
                Text(auth.effectiveCurrency.localized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Net worth unavailable")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, .medium)
        .padding(.vertical, .medium)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.all, .medium)
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

    @MainActor
    private func handleFetchEntries() async {
        let result = await portfolio.fetchEntries()
        if case .failure = result {
            toast = .error(message: NSLocalizedString("Failed to load portfolio entries", comment: ""))
            return
        }

        await portfolio.fetchNetWorth(preferredCurrency: auth.effectiveCurrency)
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioScreen()
    }
    .preview()
}
