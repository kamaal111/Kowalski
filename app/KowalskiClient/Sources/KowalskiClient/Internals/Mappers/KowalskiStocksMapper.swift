//
//  KowalskiStocksMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

import OpenAPIRuntime

struct KowalskiStocksMapper {
    func mapSearchResponse(_ response: Components.Schemas.StocksSearchResponse) -> KowalskiStocksSearchResponse {
        let quotes = response.quotes.map(mapStockItemFromApiToResponse)

        return KowalskiStocksSearchResponse(quotes: quotes)
    }

    func mapStockItemToApi(_ stockItem: KowalskiClientStockItem) -> Components.Schemas.StocksSearchQuoteItem {
        Components.Schemas.StocksSearchQuoteItem(
            symbol: stockItem.symbol,
            exchange: stockItem.exchange,
            name: stockItem.name,
            sector: stockItem.sector,
            industry: stockItem.industry,
            exchangeDispatch: stockItem.exchangeDispatch
        )
    }

    func mapStockItemFromApiToResponse(
        _ stockItem: Components.Schemas.StocksSearchQuoteItem
    ) -> KowalskiClientStockItem {
        KowalskiClientStockItem(
            symbol: stockItem.symbol,
            exchange: stockItem.exchange,
            name: stockItem.name,
            sector: stockItem.sector,
            industry: stockItem.industry,
            exchangeDispatch: stockItem.exchangeDispatch
        )
    }
}
