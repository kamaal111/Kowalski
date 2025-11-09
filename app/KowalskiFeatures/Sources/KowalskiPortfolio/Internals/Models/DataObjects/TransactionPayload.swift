//
//  TransactionPayload.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/9/25.
//

import Foundation

struct TransactionPayload {
    let symbolOrIsin: String
    let amount: Double
    let purchasePrice: Money
    let transactionType: TransactionType
    let transactionDate: Date
}
