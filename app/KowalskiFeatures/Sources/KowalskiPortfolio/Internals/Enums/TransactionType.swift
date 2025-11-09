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

    var label: String {
        switch self {
        case .purchase: NSLocalizedString("Purchase", bundle: .module, comment: "")
        case .sell: NSLocalizedString("Sell", bundle: .module, comment: "")
        }
    }
}
