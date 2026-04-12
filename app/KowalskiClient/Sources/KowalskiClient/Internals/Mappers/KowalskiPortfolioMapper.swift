//
//  KowalskiPortfolioMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import KamaalExtensions

struct KowalskiPortfolioMapper {
    let stocksMapper: KowalskiStocksMapper

    init() {
        stocksMapper = KowalskiStocksMapper()
    }

    func mapCreateEntryPayloadToApi(
        _ payload: KowalskiPortfolioCreateEntryPayload,
    ) -> Components.Schemas.CreateEntryPayload {
        let stock = stocksMapper.mapStockItemToApi(payload.stock)
        let transactionType: Components.Schemas.CreateEntryPayload.TransactionTypePayload =
            switch payload.transactionType {
            case .buy: .buy
            case .sell: .sell
            case .split: .split
            }

        return Components.Schemas.CreateEntryPayload(
            stock: stock,
            amount: payload.amount,
            purchasePrice: Components.Schemas.Money(
                currency: payload.purchasePrice.currency,
                value: payload.purchasePrice.value,
            ),
            transactionType: transactionType,
            transactionDate: payload.transactionDate,
        )
    }

    func mapBulkCreateEntryItemPayloadToApi(
        _ payload: KowalskiPortfolioBulkCreateEntryItemPayload,
    ) -> Components.Schemas.BulkCreateEntryItemPayload {
        let stock = stocksMapper.mapStockItemToApi(payload.stock)
        let transactionType: Components.Schemas.BulkCreateEntryItemPayload.TransactionTypePayload =
            switch payload.transactionType {
            case .buy: .buy
            case .sell: .sell
            case .split: .split
            }
        return Components.Schemas.BulkCreateEntryItemPayload(
            stock: stock,
            amount: payload.amount,
            purchasePrice: Components.Schemas.Money(
                currency: payload.purchasePrice.currency,
                value: payload.purchasePrice.value,
            ),
            transactionType: transactionType,
            transactionDate: payload.transactionDate,
            id: payload.id,
        )
    }

    func mapCreateEntryApiResponseToClient(
        _ response: Components.Schemas.CreateEntryResponse,
    ) -> KowalskiPortfolioClientEntryResponse {
        mapEntryApiResponseToClient(response)
    }

    func mapListEntriesApiResponseToClient(
        _ response: Components.Schemas.ListEntriesResponse,
    ) -> [KowalskiPortfolioClientEntryResponse] {
        response.map(mapEntryApiResponseToClient)
    }

    func mapBulkCreateEntriesApiResponseToClient(
        _ response: Components.Schemas.BulkCreateEntriesResponse,
    ) -> [KowalskiPortfolioClientEntryResponse] {
        response.map(mapEntryApiResponseToClient)
    }

    func mapOverviewApiResponseToClient(
        _ response: Components.Schemas.PortfolioOverviewResponse,
    ) -> KowalskiPortfolioOverviewResponse {
        let currentValues = response.currentValues.additionalProperties
            .reduce([:]) { $0.merged(with: [$1.key: mapCurrentValue($1.value)]) }

        return KowalskiPortfolioOverviewResponse(
            transactions: mapListEntriesApiResponseToClient(response.transactions),
            currentValues: currentValues,
        )
    }

    func mapEntryApiResponseToClient(
        _ response: Components.Schemas.CreateEntryResponse,
    ) -> KowalskiPortfolioClientEntryResponse {
        KowalskiPortfolioClientEntryResponse(
            id: response.id,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
            stock: stocksMapper.mapStockItemFromApiToResponse(response.stock),
            amount: response.amount,
            purchasePrice: mapMoney(response.purchasePrice),
            preferredCurrencyPurchasePrice: mapPreferredCurrencyPurchasePrice(response.preferredCurrencyPurchasePrice),
            transactionType: mapTransactionType(response.transactionType),
            transactionDate: response.transactionDate,
        )
    }

    private func mapMoney(_ response: Components.Schemas.Money) -> KowalskiClientMoney {
        KowalskiClientMoney(
            currency: response.currency,
            value: response.value,
        )
    }

    private func mapCurrentValue(_ response: Components.Schemas.CurrentValue) -> KowalskiClientMoney {
        KowalskiClientMoney(
            currency: response.currency,
            value: response.value,
        )
    }

    private func mapTransactionType(
        _ response: Components.Schemas.CreateEntryResponse.TransactionTypePayload,
    ) -> KowalskiClientPortfolioTransactionTypes {
        switch response {
        case .buy: .buy
        case .sell: .sell
        case .split: .split
        }
    }

    private func mapPreferredCurrencyPurchasePrice(
        _ response: Components.Schemas.PreferredCurrencyPurchasePrice,
    ) -> KowalskiClientMoney? {
        guard let money = response.value1 else { return nil }

        return mapMoney(money)
    }
}
