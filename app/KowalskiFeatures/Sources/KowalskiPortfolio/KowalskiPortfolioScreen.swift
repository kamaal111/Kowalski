//
//  KowalskiPortfolioScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import KamaalUI
import KowalskiDesignSystem
import SwiftUI

public struct KowalskiPortfolioScreen: View {
    public init() {}

    public var body: some View {
        VStack {
            Text("Kowalski")
                .font(.title)
        }
        .padding(.all, .medium)
        .ktakeSizeEagerly(alignment: .topLeading)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                NavigationLink(destination: { KowalskiPortfolioTransactionScreen() }) {
                    Image(systemName: "plus")
                }
            }
        }
        .frame(minSize: ModuleConfig.screenMinSize)
        .navigationTitle("")
        .onAppear(perform: handleOnAppear)
    }

    private func handleOnAppear() {
        print("🐸🐸🐸 appearing in portfolio")
    }
}

#Preview {
    NavigationStack {
        KowalskiPortfolioScreen()
    }
    .preview()
}
