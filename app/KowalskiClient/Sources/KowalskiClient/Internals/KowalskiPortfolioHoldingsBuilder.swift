//
//  KowalskiPortfolioHoldingsBuilder.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 5/23/26.
//

import Foundation

struct KowalskiPortfolioHoldingsBuilder {
    private init() {}

    static func make(
        entries: [KowalskiPortfolioClientEntryResponse],
        currentValues: [String: KowalskiClientMoney],
    ) -> [KowalskiPortfolioHoldingResponse] {
        entries.reduce([String: KowalskiPortfolioHoldingResponse]()) { partialResult, entry in
            let amountDelta: Double = switch entry.transactionType {
            case .buy: entry.amount
            case .sell: -entry.amount
            case .split: 0
            }
            guard amountDelta != 0 else { return partialResult }

            let unitValue = currentValues[entry.stock.symbol] ?? entry.purchasePrice
            let existingHolding = partialResult[entry.stock.symbol]
            let amount = (existingHolding?.amount ?? 0) + amountDelta
            let totalValue = KowalskiClientMoney(currency: unitValue.currency, value: amount * unitValue.value)
            let previousCostBasis: Double? = if let existingHolding {
                existingHolding.profitLoss.map {
                    existingHolding.totalValue.value - $0.amount.value
                }
            } else {
                0
            }
            let costBasisMoney = entry.preferredCurrencyPurchasePrice
            let profitLoss = makeProfitLoss(
                previousCostBasis: previousCostBasis,
                costBasisMoney: costBasisMoney,
                amountDelta: amountDelta,
                unitValue: unitValue,
                totalValue: totalValue,
            )
            var updatedResult = partialResult
            updatedResult[entry.stock.symbol] = KowalskiPortfolioHoldingResponse(
                assetType: "equity",
                asset: KowalskiPortfolioAssetResponse(
                    symbol: entry.stock.symbol,
                    exchange: entry.stock.exchange,
                    name: entry.stock.name,
                    isin: entry.stock.isin,
                    sector: entry.stock.sector,
                    industry: entry.stock.industry,
                    exchangeDispatch: entry.stock.exchangeDispatch,
                ),
                amount: amount,
                unitValue: unitValue,
                totalValue: totalValue,
                profitLoss: profitLoss,
            )

            return updatedResult
        }
        .values
        .filter { $0.amount != 0 }
        .sorted {
            if $0.totalValue.value == $1.totalValue.value {
                return $0.asset.symbol < $1.asset.symbol
            }

            return $0.totalValue.value > $1.totalValue.value
        }
    }

    private static func makeProfitLoss(
        previousCostBasis: Double?,
        costBasisMoney: KowalskiClientMoney,
        amountDelta: Double,
        unitValue: KowalskiClientMoney,
        totalValue: KowalskiClientMoney,
    ) -> KowalskiPortfolioHoldingProfitLossResponse? {
        guard costBasisMoney.currency == unitValue.currency else { return nil }
        guard let previousCostBasis else { return nil }

        let costBasis = previousCostBasis + amountDelta * costBasisMoney.value
        let profitLossValue = totalValue.value - costBasis

        return KowalskiPortfolioHoldingProfitLossResponse(
            amount: KowalskiClientMoney(currency: unitValue.currency, value: profitLossValue),
            percentage: costBasis == 0 ? nil : (profitLossValue / costBasis) * 100,
        )
    }
}
