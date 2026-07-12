//
//  KowalskiPortfolioHoldingsDistributionChartView.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 7/12/26.
//

import Charts
import KowalskiDesignSystem
import SwiftUI

private let lightCategoricalColors = [
    "#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834",
]
private let darkCategoricalColors = [
    "#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926",
]
struct KowalskiPortfolioHoldingsDistributionChartView: View {
    @Environment(\.colorScheme) private var colorScheme

    let distribution: PortfolioHoldingsDistribution

    var body: some View {
        VStack(alignment: .leading, spacing: KowalskiSizes.small.rawValue) {
            Chart(sortedHoldings.indices, id: \.self) { index in
                let holding = sortedHoldings[index]

                SectorMark(
                    angle: .value("Market Value", holding.marketValue.value),
                    innerRadius: .ratio(0.55),
                    angularInset: 1.5,
                )
                .foregroundStyle(color(for: index))
                .cornerRadius(4)
            }
            .chartLegend(.hidden)
            .frame(height: 220)

            legend
        }
    }

    private var legend: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 92), spacing: KowalskiSizes.small.rawValue)],
            alignment: .leading,
            spacing: KowalskiSizes.extraSmall.rawValue,
        ) {
            ForEach(sortedHoldings.indices, id: \.self) { index in
                let holding = sortedHoldings[index]

                HStack(spacing: KowalskiSizes.extraSmall.rawValue) {
                    Circle()
                        .fill(color(for: index))
                        .frame(width: 8, height: 8)
                    Text(holding.symbol)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
        }
    }

    private var sortedHoldings: [PortfolioHoldingDistributionItem] {
        distribution.holdings.sorted { $0.marketValue.value > $1.marketValue.value }
    }

    private func color(for index: Int) -> Color {
        let palette = colorScheme == .dark ? darkCategoricalColors : lightCategoricalColors

        return Color(hex: palette[index % palette.count])
    }
}

private extension Color {
    init(hex: String) {
        let hexValue = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0

        self.init(
            red: Double((hexValue >> 16) & 0xFF) / 255,
            green: Double((hexValue >> 8) & 0xFF) / 255,
            blue: Double(hexValue & 0xFF) / 255,
        )
    }
}
