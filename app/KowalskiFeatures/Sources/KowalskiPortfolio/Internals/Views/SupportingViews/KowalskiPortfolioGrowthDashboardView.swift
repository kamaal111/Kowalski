//
//  KowalskiPortfolioGrowthDashboardView.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import KowalskiDesignSystem
import KowalskiModels
import SwiftUI

struct KowalskiPortfolioGrowthDashboardView: View {
    @State private var selectedGrowthPoint: PortfolioGrowthPoint?

    let growth: PortfolioGrowthOverTime
    let showsMoneyValues: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: KowalskiSizes.medium.rawValue) {
            header

            if showsMoneyValues {
                KowalskiPortfolioGrowthChartView(
                    growth: growth,
                    selectedGrowthPoint: $selectedGrowthPoint,
                )
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
                Text("Portfolio Growth Over Time", bundle: .module)
                    .font(.title3.weight(.semibold))
                Text(summaryText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let currentPoint = growth.points.last(where: \.isCurrent) {
                Text(formattedValue(currentPoint.value))
                    .font(.headline.weight(.semibold))
                    .accessibilityIdentifier(
                        showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier,
                    )
            }
        }
    }

    private var summaryText: String {
        guard let firstPoint = growth.points.first,
              let lastPoint = growth.points.last
        else {
            return NSLocalizedString("No growth points", bundle: .module, comment: "")
        }

        return "\(formattedDate(firstPoint.date)) - \(formattedDate(lastPoint.date))"
    }

    private func formattedValue(_ value: Double) -> String {
        guard showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }

        return value.formatted(.currency(code: growth.currency.rawValue))
    }

    private func formattedDate(_ date: Date) -> String {
        date.formatted(.dateTime.year().month(.abbreviated).day())
    }
}
