//
//  TransactionType.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/9/25.
//

import Foundation

enum TransactionType: CaseIterable {
    case purchase
    case sell
    case split

    var label: String {
        switch self {
        case .purchase: NSLocalizedString("Purchase", comment: "")
        case .sell: NSLocalizedString("Sell", comment: "")
        case .split: NSLocalizedString("Split", comment: "")
        }
    }
}
