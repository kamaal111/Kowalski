//
//  TransactionType.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/9/25.
//

import Foundation

enum TransactionType: CaseIterable, Identifiable {
    struct PairedAction: Equatable {
        let transactionType: TransactionType
        let title: String
    }

    case purchase
    case sell
    case split

    var id: Self {
        self
    }

    var pairedActions: [PairedAction] {
        switch self {
        case .purchase:
            [
                PairedAction(transactionType: .split, title: NSLocalizedString("Split", comment: "")),
                PairedAction(transactionType: .sell, title: NSLocalizedString("Sell", comment: "")),
            ]
        case .sell:
            [PairedAction(transactionType: .purchase, title: NSLocalizedString("Buy", comment: ""))]
        case .split:
            []
        }
    }

    var label: String {
        switch self {
        case .purchase: NSLocalizedString("Purchase", comment: "")
        case .sell: NSLocalizedString("Sell", comment: "")
        case .split: NSLocalizedString("Split", comment: "")
        }
    }

    var amountFieldTitle: String {
        switch self {
        case .purchase, .sell: NSLocalizedString("Amount", comment: "")
        case .split: NSLocalizedString("Ratio", comment: "")
        }
    }

    var amountFieldPrefix: String? {
        switch self {
        case .purchase, .sell: nil
        case .split: "1/"
        }
    }

    var purchasePriceTitle: String {
        switch self {
        case .purchase, .sell: NSLocalizedString("Purchase price", comment: "")
        case .split: NSLocalizedString("Price before split", comment: "")
        }
    }

    var screenTitle: String {
        switch self {
        case .purchase: NSLocalizedString("Buy Transaction", comment: "")
        case .sell: NSLocalizedString("Sell Transaction", comment: "")
        case .split: NSLocalizedString("Split Transaction", comment: "")
        }
    }
}
