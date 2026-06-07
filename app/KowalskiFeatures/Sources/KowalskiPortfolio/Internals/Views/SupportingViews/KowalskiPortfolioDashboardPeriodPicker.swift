//
//  KowalskiPortfolioDashboardPeriodPicker.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 6/7/26.
//

import KowalskiClient
import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioDashboardPeriodPicker: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    @Binding var dashboardLoadFailed: Bool
    @Binding var toast: Toast?

    var body: some View {
        Picker("Dashboard period", selection: periodSelection) {
            ForEach(KowalskiPortfolioDashboardPeriod.allCases, id: \.self) { period in
                Text(period.dashboardLabel)
                    .tag(period)
            }
        }
        .pickerStyle(.segmented)
        .disabled(portfolio.isLoadingDashboardData)
    }

    private var periodSelection: Binding<KowalskiPortfolioDashboardPeriod> {
        Binding(
            get: { portfolio.dashboardPeriod },
            set: { period in
                Task {
                    await setDashboardPeriod(period)
                }
            },
        )
    }

    @MainActor
    private func setDashboardPeriod(_ period: KowalskiPortfolioDashboardPeriod) async {
        dashboardLoadFailed = false
        let result = await portfolio.setDashboardPeriod(period)
        if case .failure = result {
            dashboardLoadFailed = true
            toast = .error(message: NSLocalizedString("Dashboard unavailable", bundle: .module, comment: ""))
        }
    }
}

#Preview {
    @Previewable @State var dashboardLoadFailed = false
    @Previewable @State var toast: Toast?

    KowalskiPortfolioDashboardPeriodPicker(
        dashboardLoadFailed: $dashboardLoadFailed,
        toast: $toast,
    )
    .padding()
    .preview()
}
