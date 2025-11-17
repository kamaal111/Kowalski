//
//  KowalskiStocksSearchResponse.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

public struct KowalskiStocksSearchResponse: Codable, Sendable {
    public let quotes: [KowalskiStocksSearchQuoteItemResponse]

    public init(quotes: [KowalskiStocksSearchQuoteItemResponse]) {
        self.quotes = quotes
    }

    public var count: Int {
        quotes.count
    }
}
