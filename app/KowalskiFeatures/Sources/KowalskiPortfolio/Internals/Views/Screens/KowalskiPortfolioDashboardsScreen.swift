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
                KowalskiPortfolioDashboardTabPicker()

                if portfolio.selectedDashboardTab == .progress {
                    KowalskiPortfolioDashboardPeriodPicker(dashboardLoadFailed: $dashboardLoadFailed, toast: $toast)
                }

                if portfolio.isRefreshingStaleDashboards {
                    KowalskiPortfolioDashboardRefreshHintView()
                }
                if portfolio.isShowingDashboardLoadingState {
                    KowalskiPortfolioDashboardStatusView(status: .loading)
                } else if dashboardLoadFailed {
                    KowalskiPortfolioDashboardStatusView(status: .error)
                } else if portfolio.isShowingDashboardEmptyState {
                    KowalskiPortfolioDashboardStatusView(status: .empty)
                } else if portfolio.selectedDashboardTab == .progress {
                    if let growth = portfolio.dashboards?.portfolioGrowthOverTime {
                        KowalskiPortfolioGrowthDashboardView(
                            growth: growth,
                            showsMoneyValues: portfolio.showsMoneyValues,
                        )
                    }
                } else if portfolio.selectedDashboardTab == .holdings {
                    if let distribution = portfolio.dashboards?.portfolioHoldingsDistribution {
                        KowalskiPortfolioHoldingsDistributionDashboardView(
                            distribution: distribution,
                            showsMoneyValues: portfolio.showsMoneyValues,
                        )
                    }
                }
            }
            .padding(.all, .medium)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .navigationTitle("Dashboards")
        .task {
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
