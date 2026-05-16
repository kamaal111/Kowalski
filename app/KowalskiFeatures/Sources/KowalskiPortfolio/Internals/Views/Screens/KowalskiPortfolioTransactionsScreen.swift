//
//  KowalskiPortfolioTransactionsScreen.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/16/26.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioTransactionsScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    var body: some View {
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
            .accessibilityIdentifier("portfolio-entry-\(entry.stock.name)")
            .accessibilityChildren {
                Text(entry.stock.name)
                Text("\(entry.amount.formatted(.number)) shares")
            }
        }
        .listStyle(.inset)
        .navigationTitle("Transactions")
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioTransactionsScreen()
    }
    .preview()
}
