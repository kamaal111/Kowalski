//
//  KowalskiPortfolioDashboardTabPicker.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 7/12/26.
//

import SwiftUI

struct KowalskiPortfolioDashboardTabPicker: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    var body: some View {
        Picker("Dashboard tab", selection: tabSelection) {
            ForEach(KowalskiPortfolioDashboardTab.allCases, id: \.self) { tab in
                Text(tab.dashboardLabel)
                    .tag(tab)
            }
        }
        .pickerStyle(.segmented)
    }

    private var tabSelection: Binding<KowalskiPortfolioDashboardTab> {
        Binding(
            get: { portfolio.selectedDashboardTab },
            set: { tab in portfolio.setDashboardTab(tab) },
        )
    }
}

#Preview {
    KowalskiPortfolioDashboardTabPicker()
        .padding()
        .preview()
}
