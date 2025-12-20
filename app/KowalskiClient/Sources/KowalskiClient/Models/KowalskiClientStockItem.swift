//
//  KowalskiClientStockItem.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

public struct KowalskiClientStockItem: Codable, Sendable {
    public let symbol: String
    public let exchange: String
    public let name: String
    public let sector: String?
    public let industry: String?
    public let exchangeDispatch: String?

    public init(
        symbol: String,
        exchange: String,
        name: String,
        sector: String?,
        industry: String?,
        exchangeDispatch: String?
    ) {
        self.symbol = symbol
        self.exchange = exchange
        self.name = name
        self.sector = sector
        self.industry = industry
        self.exchangeDispatch = exchangeDispatch
    }
}
