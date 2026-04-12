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
        _ response: Components.Schemas.CreateEntryResponse.PreferredCurrencyPurchasePricePayload,
    ) -> KowalskiClientMoney? {
        // The OpenAPI generator models `Money | null` as a wrapper containing both the decoded `Money`
        // and a generic `OpenAPIValueContainer`. When the payload is actually `null`, `value1` isn't
        // meaningful, so we have to inspect the generic container to distinguish "real money object"
        // from "JSON null" before mapping the money value.
        guard response.value2.value != nil else { return nil }

        return mapMoney(response.value1)
    }
}
