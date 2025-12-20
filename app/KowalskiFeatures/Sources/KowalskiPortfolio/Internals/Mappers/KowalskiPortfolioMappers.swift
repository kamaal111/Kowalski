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

    func mapTransactionPayloadToCreateEntryPayload(
        _ payload: TransactionPayload
    ) -> KowalskiPortfolioCreateEntryPayload {
        let stock = mapStockToKowalskiClientStockItem(payload.stock)
        let purchasePrice = KowalskiClientMoney(
            currency: payload.purchasePrice.currency.rawValue,
            value: payload.purchasePrice.value
        )
        let transactionType: KowalskiClientPortfolioTransactionTypes =
            switch payload.transactionType {
            case .purchase: .buy
            case .sell: .sell
            case .split: .split
            }

        return KowalskiPortfolioCreateEntryPayload(
            stock: stock,
            amount: payload.amount,
            purchasePrice: purchasePrice,
            transactionType: transactionType,
            transactionDate: payload.transactionDate
        )
    }

    private func mapStockToKowalskiClientStockItem(_ stock: Stock) -> KowalskiClientStockItem {
        KowalskiClientStockItem(
            symbol: stock.symbol,
            exchange: stock.exchange,
            name: stock.name,
            sector: stock.sector,
            industry: stock.industry,
            exchangeDispatch: stock.exchangeDispatch
        )
    }

    private func mapStockQuoteItem(_ item: KowalskiClientStockItem) -> Stock {
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
