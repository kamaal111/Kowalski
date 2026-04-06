//
//  PortfolioEntry.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 3/28/26.
//

import Foundation

struct PortfolioEntry: Identifiable {
    let id: String
    let createdAt: Date
    let updatedAt: Date
    let stock: Stock
    let amount: Double
    let purchasePrice: Money
    let preferredCurrencyPurchasePrice: Money?
    let transactionType: TransactionType
    let transactionDate: Date

    init(
        id: String,
        createdAt: Date,
        updatedAt: Date,
        stock: Stock,
        amount: Double,
        purchasePrice: Money,
        preferredCurrencyPurchasePrice: Money? = nil,
        transactionType: TransactionType,
        transactionDate: Date,
    ) {
        self.id = id
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.stock = stock
        self.amount = amount
        self.purchasePrice = purchasePrice
        self.preferredCurrencyPurchasePrice = preferredCurrencyPurchasePrice
        self.transactionType = transactionType
        self.transactionDate = transactionDate
    }
}
