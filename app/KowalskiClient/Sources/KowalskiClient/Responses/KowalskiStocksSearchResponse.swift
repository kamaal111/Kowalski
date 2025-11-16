//
//  KowalskiStocksSearchResponse.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

public struct KowalskiStocksSearchResponse: Codable, Sendable {
    public let quoutes: [KowalskiStocksSearchQuoteItemResponse]

    public init(quotes: [KowalskiStocksSearchQuoteItemResponse]) {
        self.quoutes = quotes
    }

    public var count: Int {
        quoutes.count
    }
}
