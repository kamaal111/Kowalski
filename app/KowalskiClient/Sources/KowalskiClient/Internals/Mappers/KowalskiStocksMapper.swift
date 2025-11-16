//
//  KowalskiStocksMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

import OpenAPIRuntime

struct KowalskiStocksMapper {
    func mapSearchResponse(_ response: Components.Schemas.StocksSearchResponse) -> KowalskiStocksSearchResponse {
        let quotes = response.quotes.map {
            KowalskiStocksSearchQuoteItemResponse(
                symbol: $0.symbol,
                exchange: $0.exchange,
                name: $0.name,
                sector: $0.sector,
                industry: $0.industry,
                exchangeDispatch: $0.exchangeDispatch
            )
        }

        return KowalskiStocksSearchResponse(quotes: quotes)
    }
}
