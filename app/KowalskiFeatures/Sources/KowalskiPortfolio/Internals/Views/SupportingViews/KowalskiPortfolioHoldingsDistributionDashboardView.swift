//
//  KowalskiPortfolioHoldingsDistributionDashboardView.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 7/12/26.
//

import KamaalExtensions
import KowalskiDesignSystem
import KowalskiModels
import SwiftUI

struct KowalskiPortfolioHoldingsDistributionDashboardView: View {
    let distribution: PortfolioHoldingsDistribution
    let showsMoneyValues: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: KowalskiSizes.medium.rawValue) {
            header

            if showsMoneyValues {
                KowalskiPortfolioHoldingsDistributionChartView(distribution: distribution)
            } else {
                KowalskiPortfolioMaskedChartPlaceholderView()
            }
        }
        .padding(.all, .medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: KowalskiSizes.extraSmall.rawValue) {
                Text("Holdings Distribution", bundle: .module)
                    .font(.title3.weight(.semibold))
                Text(summaryText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(formattedValue(totalValue))
                .font(.headline.weight(.semibold))
                .accessibilityIdentifier(
                    showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier,
                )
        }
    }

    private var totalValue: Double {
        distribution.holdings.sum(by: \.marketValue.value)
    }

    private var summaryText: String {
        let holdingCount = distribution.holdings.count
        guard holdingCount > 0 else {
            return NSLocalizedString("No holdings", bundle: .module, comment: "")
        }

        return String(localized: "\(holdingCount) holdings", bundle: .module)
    }

    private func formattedValue(_ value: Double) -> String {
        guard showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }

        return value.formatted(.currency(code: distribution.currency.rawValue))
    }
}
