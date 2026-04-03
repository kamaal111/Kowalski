//
//  KowalskiPortfolioScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import KamaalUI
import KowalskiDesignSystem
import SwiftUI

public struct KowalskiPortfolioScreen: View {
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
                entriesList
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
        .navigationTitle("Transactions")
        .task {
            guard !hasLoadedEntries else { return }

            hasLoadedEntries = true
            await handleFetchEntries()
        }
        .toastView(toast: $toast)
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
        }
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioScreen()
    }
    .preview()
}
