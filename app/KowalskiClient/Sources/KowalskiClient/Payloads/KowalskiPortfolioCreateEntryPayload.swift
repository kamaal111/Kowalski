//
//  KowalskiPortfolioCreateEntryPayload.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import Foundation

public struct KowalskiPortfolioCreateEntryPayload: Codable, Sendable {
    public let stock: KowalskiClientStockItem
    public let amount: Double
    public let purchasePrice: KowalskiClientMoney
    public let transactionType: KowalskiClientPortfolioTransactionTypes
    public let transactionDate: Date

    public init(
        stock: KowalskiClientStockItem,
        amount: Double,
        purchasePrice: KowalskiClientMoney,
        transactionType: KowalskiClientPortfolioTransactionTypes,
        transactionDate: Date,
    ) {
        self.stock = stock
        self.amount = amount
        self.purchasePrice = purchasePrice
        self.transactionType = transactionType
        self.transactionDate = transactionDate
    }

    public enum CodingKeys: String, CodingKey {
        case stock
        case amount
        case purchasePrice = "purchase_price"
        case transactionType = "transaction_type"
        case transactionDate = "transaction_date"
    }
}
