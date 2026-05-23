//
//  PortfolioEntry.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 3/28/26.
//

import Foundation

struct PortfolioEntry: Codable, Identifiable {
    let id: String
    let createdAt: Date
    let updatedAt: Date
    let stock: Stock
    let amount: Double
    let purchasePrice: Money
    let preferredCurrencyPurchasePrice: Money
    let transactionType: TransactionType
    let transactionDate: Date
}
