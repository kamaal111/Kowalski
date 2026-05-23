//
//  PortfolioHoldingDetail.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/23/26.
//

import KamaalExtensions

struct PortfolioHoldingDetail {
    let holding: PortfolioHolding
    let entries: [PortfolioEntry]
    let netWorth: Money?

    var relatedEntries: [PortfolioEntry] {
        entries
            .filter { $0.stock.symbol == holding.asset.symbol }
            .sorted { left, right in
                if left.transactionDate == right.transactionDate {
                    return left.updatedAt > right.updatedAt
                }

                return left.transactionDate > right.transactionDate
            }
    }

    var allocationPercentage: Double? {
        guard let netWorth else { return nil }
        guard netWorth.currency == holding.totalValue.currency else { return nil }
        guard netWorth.value > 0 else { return nil }

        return holding.totalValue.value / netWorth.value * 100
    }

    var averagePurchasePrice: Money? {
        let purchaseEntries = relatedEntries.filter { $0.transactionType == .purchase && $0.amount > 0 }
        let purchasePrices = purchaseEntries.map(comparablePurchasePrice)
        guard let currency = purchasePrices.first?.currency else { return nil }
        guard purchasePrices.allSatisfy({ $0.currency == currency }) else { return nil }

        let (totalShares, totalCost) = purchaseEntries.reduce((totalShares: 0.0, totalCost: 0.0)) {
            let purchasePrice = comparablePurchasePrice(for: $1)

            return ($0.totalShares + $1.amount, $0.totalCost + ($1.amount * purchasePrice.value))
        }
        guard totalShares > 0 else { return nil }

        return Money(currency: currency, value: totalCost / totalShares)
    }

    var currentPriceVsAverageCostPercentage: Double? {
        guard let averagePurchasePrice else { return nil }
        guard averagePurchasePrice.currency == holding.unitValue.currency else { return nil }
        guard averagePurchasePrice.value > 0 else { return nil }

        return (holding.unitValue.value - averagePurchasePrice.value) / averagePurchasePrice.value * 100
    }

    private func comparablePurchasePrice(for entry: PortfolioEntry) -> Money {
        entry.preferredCurrencyPurchasePrice
    }
}
