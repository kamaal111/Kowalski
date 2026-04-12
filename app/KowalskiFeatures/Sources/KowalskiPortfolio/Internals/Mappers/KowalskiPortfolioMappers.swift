//
//  KowalskiPortfolioMappers.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/17/25.
//

import ForexKit
import KamaalExtensions
import KowalskiClient
import KowalskiFeaturesConfig

struct KowalskiPortfolioMappers {
    func mapOverviewResponse(_ response: KowalskiPortfolioOverviewResponse) -> PortfolioOverviewState {
        PortfolioOverviewState(
            entries: mapPortfolioEntries(response.transactions),
            currentValues: mapCurrentValues(response.currentValues),
        )
    }

    func mapPortfolioEntries(_ entries: [KowalskiPortfolioClientEntryResponse]) -> [PortfolioEntry] {
        entries.map(mapPortfolioEntry)
    }

    func mapStocksSearchResponse(_ response: KowalskiStocksSearchResponse) -> [Stock] {
        response.quotes.map(mapStockQuoteItem)
    }

    func mapTransactionPayloadToCreateEntryPayload(
        _ payload: TransactionPayload,
    ) -> KowalskiPortfolioCreateEntryPayload {
        let stock = mapStockToKowalskiClientStockItem(payload.stock)
        let purchasePrice = KowalskiClientMoney(
            currency: payload.purchasePrice.currency.rawValue,
            value: payload.purchasePrice.value,
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
            transactionDate: payload.transactionDate,
        )
    }

    private func mapPortfolioEntry(_ entry: KowalskiPortfolioClientEntryResponse) -> PortfolioEntry {
        let transactionType: TransactionType =
            switch entry.transactionType {
            case .buy: .purchase
            case .sell: .sell
            case .split: .split
            }

        return PortfolioEntry(
            id: entry.id,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            stock: mapStockQuoteItem(entry.stock),
            amount: entry.amount,
            purchasePrice: mapMoney(entry.purchasePrice),
            preferredCurrencyPurchasePrice: mapOptionalMoney(entry.preferredCurrencyPurchasePrice),
            transactionType: transactionType,
            transactionDate: entry.transactionDate,
        )
    }

    private func mapMoney(_ money: KowalskiClientMoney) -> Money {
        Money(
            currency: Currencies(rawValue: money.currency) ?? KowalskiFeatureDefaults.fallbackCurrency,
            value: money.value,
        )
    }

    private func mapOptionalMoney(_ money: KowalskiClientMoney?) -> Money? {
        guard let money else { return nil }
        guard let currency = Currencies(rawValue: money.currency) else { return nil }

        return Money(currency: currency, value: money.value)
    }

    private func mapCurrentValues(_ currentValues: [String: KowalskiClientMoney]) -> [String: Money] {
        currentValues.reduce([:]) { $0.merged(with: [$1.key: mapMoney($1.value)]) }
    }

    private func mapStockToKowalskiClientStockItem(_ stock: Stock) -> KowalskiClientStockItem {
        KowalskiClientStockItem(
            symbol: stock.symbol,
            exchange: stock.exchange,
            name: stock.name,
            isin: stock.isin,
            sector: stock.sector,
            industry: stock.industry,
            exchangeDispatch: stock.exchangeDispatch,
        )
    }

    private func mapStockQuoteItem(_ item: KowalskiClientStockItem) -> Stock {
        Stock(
            symbol: item.symbol,
            exchange: item.exchange,
            name: item.name,
            isin: item.isin,
            sector: item.sector,
            industry: item.industry,
            exchangeDispatch: item.exchangeDispatch,
        )
    }
}

struct PortfolioOverviewState {
    let entries: [PortfolioEntry]
    let currentValues: [String: Money]
}
