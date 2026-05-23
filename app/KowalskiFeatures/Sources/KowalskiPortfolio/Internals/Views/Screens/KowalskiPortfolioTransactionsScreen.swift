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
            NavigationLink(value: KowalskiPortfolioTransactionNavigationItem.detail(entryID: entry.id)) {
                KowalskiDetailsRow(entry: entry, presentation: .transactionList)
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
        .accessibilityIdentifier("portfolio-transactions-list")
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioTransactionsScreen()
    }
    .preview()
}
