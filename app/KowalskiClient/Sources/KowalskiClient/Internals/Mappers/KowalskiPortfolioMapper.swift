//
//  KowalskiPortfolioMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import Foundation
import KamaalExtensions
import KowalskiModels

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
                currency: .init(payload.purchasePrice.currency),
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
                currency: .init(payload.purchasePrice.currency),
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
        response.map(mapResolvedEntryApiResponseToClient)
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
            holdings: response.holdings.map(mapHoldingApiResponseToClient),
            netWorth: mapMoney(response.netWorth.value1),
        )
    }

    func mapDashboardsApiResponseToClient(
        _ response: Components.Schemas.PortfolioDashboardsResponse,
    ) -> KowalskiPortfolioDashboardsResponse {
        KowalskiPortfolioDashboardsResponse(
            portfolioGrowthOverTime: KowalskiPortfolioGrowthOverTimeResponse(
                currency: mapPortfolioGrowthCurrency(response.portfolioGrowthOverTime.currency),
                points: response.portfolioGrowthOverTime.points.map(mapPortfolioGrowthPoint),
            ),
            portfolioHoldingsDistribution: KowalskiPortfolioHoldingsDistributionResponse(
                currency: response.portfolioHoldingsDistribution.currency.value1.kowalskiCurrency,
                holdings: response.portfolioHoldingsDistribution.holdings.map(mapPortfolioHoldingDistributionItem),
            ),
        )
    }

    func mapOverviewPreflightApiResponseToClient(
        _ response: Components.Schemas.PortfolioOverviewPreflightResponse,
    ) -> KowalskiPortfolioOverviewPreflightResponse {
        KowalskiPortfolioOverviewPreflightResponse(
            refreshState: mapOverviewPreflightRefreshState(response.refreshState),
            pollAfterMilliseconds: response.pollAfterMs,
            latestCachedPriceDate: response.latestCachedPriceDate,
        )
    }

    func mapResolvedEntryApiResponseToClient(
        _ response: Components.Schemas.ResolvedEntryResponse,
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
            currency: response.currency.kowalskiCurrency,
            value: response.value,
        )
    }

    private func mapPortfolioGrowthPoint(
        _ response: Components.Schemas.PortfolioGrowthPoint,
    ) -> KowalskiPortfolioGrowthPointResponse {
        KowalskiPortfolioGrowthPointResponse(
            date: mapDateOnly(response.date),
            value: response.value,
            isCurrent: response.isCurrent,
        )
    }

    private func mapPortfolioGrowthCurrency(
        _ response: Components.Schemas.PortfolioGrowthOverTime.CurrencyPayload,
    ) -> KowalskiCurrency {
        response.value1.kowalskiCurrency
    }

    private func mapPortfolioHoldingDistributionItem(
        _ response: Components.Schemas.PortfolioHoldingDistributionItem,
    ) -> KowalskiPortfolioHoldingDistributionItemResponse {
        KowalskiPortfolioHoldingDistributionItemResponse(
            symbol: response.asset.symbol,
            name: response.asset.name,
            marketValue: KowalskiClientMoney(
                currency: response.marketValue.currency.kowalskiCurrency,
                value: response.marketValue.value,
            ),
        )
    }

    private func mapDateOnly(_ response: String) -> Date {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"

        guard let date = formatter.date(from: response) else {
            preconditionFailure("Unsupported date-only string: \(response)")
        }

        return date
    }

    private func mapCurrentValue(_ response: Components.Schemas.CurrentValue) -> KowalskiClientMoney {
        KowalskiClientMoney(
            currency: response.currency.kowalskiCurrency,
            value: response.value,
        )
    }

    private func mapHoldingApiResponseToClient(
        _ response: Components.Schemas.PortfolioHolding,
    ) -> KowalskiPortfolioHoldingResponse {
        KowalskiPortfolioHoldingResponse(
            assetType: response.assetType.rawValue,
            asset: mapHoldingAsset(response.asset),
            amount: response.amount,
            unitValue: mapCurrentValue(response.unitValue.value1),
            totalValue: mapMoney(response.totalValue.value1),
            profitLoss: mapHoldingProfitLoss(response.profitLoss),
        )
    }

    private func mapOverviewPreflightRefreshState(
        _ response: Components.Schemas.PortfolioOverviewPreflightResponse.RefreshStatePayload,
    ) -> KowalskiPortfolioOverviewPreflightResponse.RefreshState {
        switch response {
        case .ready: .ready
        case .refreshing: .refreshing
        }
    }

    private func mapHoldingAsset(
        _ response: Components.Schemas.PortfolioHoldingAsset,
    ) -> KowalskiPortfolioAssetResponse {
        KowalskiPortfolioAssetResponse(
            symbol: response.symbol,
            exchange: response.exchange,
            name: response.name,
            isin: response.isin,
            sector: response.sector,
            industry: response.industry,
            exchangeDispatch: response.exchangeDispatch,
        )
    }

    private func mapHoldingProfitLoss(
        _ response: Components.Schemas.PortfolioHoldingProfitLoss?,
    ) -> KowalskiPortfolioHoldingProfitLossResponse? {
        guard let response else { return nil }

        return KowalskiPortfolioHoldingProfitLossResponse(
            amount: mapMoney(response.amount.value1),
            percentage: response.percentage,
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

    private func mapTransactionType(
        _ response: Components.Schemas.ResolvedEntryResponse.TransactionTypePayload,
    ) -> KowalskiClientPortfolioTransactionTypes {
        switch response {
        case .buy: .buy
        case .sell: .sell
        }
    }

    private func mapPreferredCurrencyPurchasePrice(
        _ response: Components.Schemas.PreferredCurrencyPurchasePrice,
    ) -> KowalskiClientMoney {
        KowalskiClientMoney(
            currency: response.currency.kowalskiCurrency,
            value: response.value,
        )
    }
}
