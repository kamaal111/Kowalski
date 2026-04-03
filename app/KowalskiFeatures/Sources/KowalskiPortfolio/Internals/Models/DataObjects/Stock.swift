//
//  Stock.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/17/25.
//

struct Stock: Hashable, Identifiable {
    let id: String
    let symbol: String
    let exchange: String
    let name: String
    let isin: String?
    let sector: String?
    let industry: String?
    let exchangeDispatch: String?

    init(
        symbol: String,
        exchange: String,
        name: String,
        isin: String?,
        sector: String?,
        industry: String?,
        exchangeDispatch: String?,
    ) {
        id = symbol
        self.symbol = symbol
        self.exchange = exchange
        self.name = name
        self.isin = isin
        self.sector = sector
        self.industry = industry
        self.exchangeDispatch = exchangeDispatch
    }
}
