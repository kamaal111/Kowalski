//
//  KowalskiStocksSearchResponse.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

public struct KowalskiStocksSearchResponse: Codable, Sendable {
    public let quotes: [KowalskiClientStockItem]

    public init(quotes: [KowalskiClientStockItem]) {
        self.quotes = quotes
    }

    public var count: Int {
        quotes.count
    }
}
