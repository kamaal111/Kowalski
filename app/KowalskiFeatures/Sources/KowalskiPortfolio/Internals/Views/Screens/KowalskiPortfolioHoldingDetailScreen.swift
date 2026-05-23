//
//  KowalskiPortfolioHoldingDetailScreen.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/23/26.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioHoldingDetailScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    let holding: PortfolioHolding

    var body: some View {
        List {
            Section {
                headerView
            }
            Section("Summary") {
                KowalskiDetailsRow(detailTitle: "Shares", value: holding.amount.formatted(.number))
                moneyRow(title: "Unit Value", money: holding.unitValue)
                moneyRow(title: "Current Value", money: holding.totalValue)
                KowalskiDetailsRow(
                    detailTitle: "Unrealized Profit/Loss",
                    value: formattedProfitLoss,
                    valueAccessibilityIdentifier: profitLossAccessibilityIdentifier,
                )
                KowalskiDetailsRow(detailTitle: "Allocation", value: formattedAllocationPercentage)
            }
            Section("Cost") {
                KowalskiDetailsRow(
                    detailTitle: "Average Buy Price",
                    value: formattedAveragePurchasePrice,
                    valueAccessibilityIdentifier: moneyAccessibilityIdentifier,
                )
                KowalskiDetailsRow(
                    detailTitle: "Current vs Average Cost",
                    value: formattedCurrentPriceVsAverageCost,
                    valueAccessibilityIdentifier: moneyAccessibilityIdentifier,
                )
            }
            Section("Asset") {
                KowalskiDetailsRow(detailTitle: "Exchange", value: holding.asset.exchangeDispatch ?? unavailableValue)
                KowalskiDetailsRow(detailTitle: "Exchange Code", value: holding.asset.exchange)
                KowalskiDetailsRow(detailTitle: "ISIN", value: holding.asset.isin ?? unavailableValue)
                KowalskiDetailsRow(detailTitle: "Sector", value: holding.asset.sector ?? unavailableValue)
                KowalskiDetailsRow(detailTitle: "Industry", value: holding.asset.industry ?? unavailableValue)
            }
            Section("Related Transactions") {
                if detail.relatedEntries.isEmpty {
                    Text("No related transactions")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(detail.relatedEntries) { entry in
                        NavigationLink(
                            value: KowalskiPortfolioNavigationPathItem
                                .transactionDetail(entryID: entry.id),
                        ) {
                            KowalskiDetailsRow(
                                entry: entry,
                                presentation: .holdingRelated(
                                    purchasePrice: formattedPurchasePrice(entry),
                                    purchasePriceAccessibilityIdentifier: moneyAccessibilityIdentifier,
                                ),
                            )
                        }
                    }
                }
            }
        }
        .listStyle(.inset)
        .navigationTitle(holding.asset.symbol)
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                NavigationLink(value: KowalskiPortfolioNavigationPathItem.holdingTransaction(
                    symbol: holding.asset.symbol,
                    transactionType: .purchase,
                )) {
                    Text("Buy")
                }
                NavigationLink(value: KowalskiPortfolioNavigationPathItem.holdingTransaction(
                    symbol: holding.asset.symbol,
                    transactionType: .sell,
                )) {
                    Text("Sell")
                }
            }
        }
        .accessibilityIdentifier("portfolio-holding-detail-\(holding.asset.symbol)")
    }

    private var detail: PortfolioHoldingDetail {
        PortfolioHoldingDetail(
            holding: holding,
            entries: portfolio.entries,
            netWorth: portfolio.netWorth,
        )
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(holding.asset.symbol)
                    .font(.title2.weight(.semibold))
                Text(holding.asset.name)
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
            Text(headerMetadata)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, .extraSmall)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("\(holding.asset.name), \(holding.amount.formatted(.number)) shares"))
    }

    private var headerMetadata: String {
        [
            holding.asset.exchangeDispatch ?? holding.asset.exchange,
            holding.asset.sector ?? unavailableValue,
            holding.asset.industry ?? unavailableValue,
        ].joined(separator: " - ")
    }

    private var formattedProfitLoss: String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }
        guard let profitLoss = holding.profitLoss else { return unavailableValue }

        let amount = PortfolioValueFormatting.signedCurrency(
            value: profitLoss.amount.value,
            currency: profitLoss.amount.currency,
        )
        guard let percentage = profitLoss.percentage else { return amount }

        return "\(amount) \(PortfolioValueFormatting.signedPercent(percentage))"
    }

    private var formattedAllocationPercentage: String {
        guard let allocationPercentage = detail.allocationPercentage else { return unavailableValue }

        return PortfolioValueFormatting.percent(allocationPercentage)
    }

    private var formattedAveragePurchasePrice: String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }
        guard let averagePurchasePrice = detail.averagePurchasePrice else { return unavailableValue }

        return averagePurchasePrice.value.formatted(.currency(code: averagePurchasePrice.currency.rawValue))
    }

    private var formattedCurrentPriceVsAverageCost: String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }
        guard let priceVsAverageCost = detail.currentPriceVsAverageCostPercentage else { return unavailableValue }

        return PortfolioValueFormatting.signedPercent(priceVsAverageCost)
    }

    private var profitLossAccessibilityIdentifier: String {
        portfolio.showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier
    }

    private var moneyAccessibilityIdentifier: String {
        portfolio.showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier
    }

    private var unavailableValue: String {
        NSLocalizedString("Unavailable", bundle: .module, comment: "")
    }

    private func formattedPurchasePrice(_ entry: PortfolioEntry) -> String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }

        return entry.purchasePrice.value.formatted(.currency(code: entry.purchasePrice.currency.rawValue))
    }

    private func moneyRow(title: LocalizedStringKey, money: Money) -> some View {
        KowalskiDetailsRow(
            detailTitle: title,
            value: portfolio.showsMoneyValues
                ? money.value.formatted(.currency(code: money.currency.rawValue))
                : PortfolioMoneyValuePrivacy.maskedPlaceholder,
            valueAccessibilityIdentifier: moneyAccessibilityIdentifier,
        )
    }
}

#Preview("Holding detail") {
    NavigationStack {
        KowalskiPortfolioHoldingDetailScreen(
            holding: PortfolioHolding(
                assetType: "stock",
                asset: PortfolioAsset(
                    symbol: "AAPL",
                    exchange: "NMS",
                    name: "Apple Inc.",
                    isin: "US0378331005",
                    sector: "Technology",
                    industry: "Consumer Electronics",
                    exchangeDispatch: "NASDAQ",
                ),
                amount: 10,
                unitValue: Money(currency: .USD, value: 185.45),
                totalValue: Money(currency: .USD, value: 1854.5),
                profitLoss: PortfolioHoldingProfitLoss(
                    amount: Money(currency: .USD, value: 349.5),
                    percentage: 23.22,
                ),
            ),
        )
    }
    .preview()
}
