//
//  KowalskiPortfolioMaskedChartPlaceholderView.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import SwiftUI

struct KowalskiPortfolioMaskedChartPlaceholderView: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(.secondary.opacity(0.12))
            .overlay {
                Text(PortfolioMoneyValuePrivacy.maskedPlaceholder)
                    .font(.largeTitle.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier(PortfolioMoneyValuePrivacy.accessibilityIdentifier)
            }
            .frame(height: 280)
    }
}
