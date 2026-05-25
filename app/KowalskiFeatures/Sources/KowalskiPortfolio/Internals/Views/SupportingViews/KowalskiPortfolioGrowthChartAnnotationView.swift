//
//  KowalskiPortfolioGrowthChartAnnotationView.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import KowalskiDesignSystem
import KowalskiModels
import SwiftUI

struct KowalskiPortfolioGrowthChartAnnotationView: View {
    let point: PortfolioGrowthPoint
    let currency: KowalskiCurrency

    var body: some View {
        VStack(alignment: .leading, spacing: KowalskiSizes.extraSmall.rawValue) {
            Text(formattedDate(point.date))
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(formattedValue(point.value))
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, KowalskiSizes.small.rawValue)
        .padding(.vertical, KowalskiSizes.extraSmall.rawValue)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
    }

    private func formattedValue(_ value: Double) -> String {
        value.formatted(.currency(code: currency.rawValue))
    }

    private func formattedDate(_ date: Date) -> String {
        date.formatted(.dateTime.year().month(.abbreviated).day())
    }
}
