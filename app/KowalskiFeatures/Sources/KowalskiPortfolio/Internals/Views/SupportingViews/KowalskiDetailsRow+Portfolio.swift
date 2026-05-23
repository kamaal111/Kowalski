//
//  KowalskiDetailsRow+Portfolio.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/24/26.
//

import KowalskiDesignSystem
import SwiftUI

extension KowalskiDetailsRow {
    init(entry: PortfolioEntry, presentation: PortfolioTransactionPresentation) {
        switch presentation {
        case .transactionList:
            self.init(
                title: LocalizedStringKey(entry.stock.symbol),
                subtitle: entry.stock.name,
                detailTitle: LocalizedStringKey(entry.transactionType.label),
                detailValue: entry.formattedShares,
                footer: entry.formattedTransactionDate,
                accessibilityLabel: entry.stock.name,
            )
        case let .holdingRelated(purchasePrice, purchasePriceAccessibilityIdentifier):
            self.init(
                title: LocalizedStringKey(entry.transactionType.label),
                subtitle: entry.formattedTransactionDate,
                detailTitle: LocalizedStringKey(entry.formattedShares),
                detailValue: purchasePrice,
                detailValueAccessibilityIdentifier: purchasePriceAccessibilityIdentifier,
                accessibilityLabel: "\(entry.transactionType.label), \(entry.formattedShares)",
            )
        }
    }
}

enum PortfolioTransactionPresentation {
    case transactionList
    case holdingRelated(
        purchasePrice: String,
        purchasePriceAccessibilityIdentifier: String,
    )
}

private extension PortfolioEntry {
    var formattedShares: String {
        "\(amount.formatted(.number)) shares"
    }

    var formattedTransactionDate: String {
        transactionDate.formatted(.dateTime.year().month().day())
    }
}
