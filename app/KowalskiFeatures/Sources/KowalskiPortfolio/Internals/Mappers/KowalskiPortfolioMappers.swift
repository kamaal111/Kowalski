//
//  KowalskiPortfolioMappers.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/17/25.
//

import KowalskiClient

struct KowalskiPortfolioMappers {
    func mapStocksSearchResponse(_ response: KowalskiStocksSearchResponse) -> [Stock] {
        response.quotes.map(mapStockQuoteItem)
    }

    private func mapStockQuoteItem(_ item: KowalskiStocksSearchQuoteItemResponse) -> Stock {
        Stock(
            symbol: item.symbol,
            exchange: item.exchange,
            name: item.name,
            sector: item.sector,
            industry: item.industry,
            exchangeDispatch: item.exchangeDispatch
        )
    }
}
