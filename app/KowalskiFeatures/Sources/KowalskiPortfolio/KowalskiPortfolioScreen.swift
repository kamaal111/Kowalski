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
    @State private var toast: Toast?

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
                NavigationLink(destination: {
                    KowalskiPortfolioTransactionScreen(onTransactionAdd: { payload in
                        toast = .success(
                            message: String(localized: "\(payload.stock.name) entry added"),
                        )
                    })
                }) {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(Text("Add entry"))
            }
        }
        .frame(minSize: ModuleConfig.screenMinSize)
        .navigationTitle("")
        .onAppear(perform: handleOnAppear)
        .toastView(toast: $toast)
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
