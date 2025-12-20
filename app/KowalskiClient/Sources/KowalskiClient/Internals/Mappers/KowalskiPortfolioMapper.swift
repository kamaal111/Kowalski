//
//  KowalskiPortfolioMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

struct KowalskiPortfolioMapper {
    let stocksMapper: KowalskiStocksMapper

    init() {
        self.stocksMapper = KowalskiStocksMapper()
    }

    func mapCreateEntryPayloadToApi(
        _ payload: KowalskiPortfolioCreateEntryPayload
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
                value: payload.purchasePrice.value
            ),
            transactionType: transactionType,
            transactionDate: payload.transactionDate
        )
    }

    func mapCreateEntryApiResponseToClient(
        _ response: Components.Schemas.CreateEntryResponse
    ) -> KowalskiPortfolioClientCreateEntryResponse {
        let stock = stocksMapper.mapStockItemFromApiToResponse(response.stock)
        let transactionType: KowalskiClientPortfolioTransactionTypes =
            switch response.transactionType {
            case .buy: .buy
            case .sell: .sell
            case .split: .split
            }

        return KowalskiPortfolioClientCreateEntryResponse(
            id: response.id,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt,
            stock: stock,
            amount: response.amount,
            purchasePrice: KowalskiClientMoney(
                currency: response.purchasePrice.currency,
                value: response.purchasePrice.value
            ),
            transactionType: transactionType,
            transactionDate: response.transactionDate
        )
    }
}
