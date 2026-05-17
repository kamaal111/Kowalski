//
//  KowalskiPortfolioSidebar.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 5/20/26.
//

import SwiftUI

struct KowalskiPortfolioSidebar: View {
    @Binding var selectedNavigationItem: KowalskiPortfolioNavigationItem?

    var body: some View {
        List(selection: $selectedNavigationItem) {
            NavigationLink(value: KowalskiPortfolioNavigationItem.portfolio) {
                Label("Portfolio", systemImage: "chart.pie")
            }

            NavigationLink(value: KowalskiPortfolioNavigationItem.transactions) {
                Label("Transactions", systemImage: "list.bullet.rectangle")
            }
        }
        .navigationTitle("Net Worth")
    }
}

#Preview {
    KowalskiPortfolioSidebar(selectedNavigationItem: .constant(.portfolio))
}
