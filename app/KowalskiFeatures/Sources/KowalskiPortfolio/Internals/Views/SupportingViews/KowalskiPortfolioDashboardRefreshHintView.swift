//
//  KowalskiPortfolioDashboardRefreshHintView.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 6/12/26.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioDashboardRefreshHintView: View {
    var body: some View {
        HStack(spacing: KowalskiSizes.small.rawValue) {
            ProgressView()
                .controlSize(.small)
                .tint(Color.accentColor)
            Text("Updating dashboards...", bundle: .module)
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.accentColor)
        }
        .padding(.horizontal, .medium)
        .padding(.vertical, .small)
        .background(Color.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("Updating dashboards", bundle: .module))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    KowalskiPortfolioDashboardRefreshHintView()
        .padding()
}
