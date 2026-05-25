//
//  KowalskiPortfolioDashboardsScreen.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioDashboardsScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    @State private var dashboardLoadFailed = false
    @State private var toast: Toast?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KowalskiSizes.medium.rawValue) {
                if portfolio.isShowingDashboardLoadingState {
                    KowalskiPortfolioDashboardStatusView(status: .loading)
                } else if dashboardLoadFailed {
                    KowalskiPortfolioDashboardStatusView(status: .error)
                } else if portfolio.isShowingDashboardEmptyState {
                    KowalskiPortfolioDashboardStatusView(status: .empty)
                } else if let growth = portfolio.dashboards?.portfolioGrowthOverTime {
                    KowalskiPortfolioGrowthDashboardView(
                        growth: growth,
                        showsMoneyValues: portfolio.showsMoneyValues,
                    )
                }
            }
            .padding(.all, .medium)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .navigationTitle("Dashboards")
        .task {
            guard portfolio.dashboards == nil else { return }

            await fetchDashboards()
        }
        .toastView(toast: $toast)
    }

    @MainActor
    private func fetchDashboards() async {
        dashboardLoadFailed = false
        let result = await portfolio.fetchDashboards()
        if case .failure = result {
            dashboardLoadFailed = true
            toast = .error(message: NSLocalizedString("Dashboard unavailable", bundle: .module, comment: ""))
        }
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioDashboardsScreen()
            .preview()
    }
}
