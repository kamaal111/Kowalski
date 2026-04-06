//
//  KowalskiPortfolioClientEntryResponse.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import Foundation

public struct KowalskiPortfolioClientEntryResponse: Codable, Sendable {
    public let id: String
    public let createdAt: Date
    public let updatedAt: Date
    public let stock: KowalskiClientStockItem
    public let amount: Double
    public let purchasePrice: KowalskiClientMoney
    public let preferredCurrencyPurchasePrice: KowalskiClientMoney?
    public let transactionType: KowalskiClientPortfolioTransactionTypes
    public let transactionDate: Date

    public init(
        id: String,
        createdAt: Date,
        updatedAt: Date,
        stock: KowalskiClientStockItem,
        amount: Double,
        purchasePrice: KowalskiClientMoney,
        preferredCurrencyPurchasePrice: KowalskiClientMoney? = nil,
        transactionType: KowalskiClientPortfolioTransactionTypes,
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

    public enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case stock
        case amount
        case purchasePrice = "purchase_price"
        case preferredCurrencyPurchasePrice = "preferred_currency_purchase_price"
        case transactionType = "transaction_type"
        case transactionDate = "transaction_date"
    }
}
