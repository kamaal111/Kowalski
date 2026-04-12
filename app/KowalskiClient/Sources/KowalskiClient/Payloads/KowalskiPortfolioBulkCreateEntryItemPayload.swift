//
//  KowalskiPortfolioBulkCreateEntryItemPayload.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 4/12/26.
//

import Foundation

public struct KowalskiPortfolioBulkCreateEntryItemPayload: Codable, Sendable {
    public let id: String?
    public let stock: KowalskiClientStockItem
    public let amount: Double
    public let purchasePrice: KowalskiClientMoney
    public let transactionType: KowalskiClientPortfolioTransactionTypes
    public let transactionDate: Date

    public init(
        id: String? = nil,
        stock: KowalskiClientStockItem,
        amount: Double,
        purchasePrice: KowalskiClientMoney,
        transactionType: KowalskiClientPortfolioTransactionTypes,
        transactionDate: Date,
    ) {
        self.id = id
        self.stock = stock
        self.amount = amount
        self.purchasePrice = purchasePrice
        self.transactionType = transactionType
        self.transactionDate = transactionDate
    }

    public enum CodingKeys: String, CodingKey {
        case id
        case stock
        case amount
        case purchasePrice = "purchase_price"
        case transactionType = "transaction_type"
        case transactionDate = "transaction_date"
    }
}
