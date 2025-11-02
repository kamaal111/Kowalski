//
//  KowalskiPortfolioScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import SwiftUI
import KowalskiAuth
import KowalskiDesignSystem

public struct KowalskiPortfolioScreen: View {
    @Environment(KowalskiAuth.self) private var auth

    public init() { }

    public var body: some View {
        NavigationStack {
            VStack {
                Text("Hello, World!")
            }
        }
        .frame(minSize: ModuleConfig.screenMinSize)
    }
}

#Preview {
    KowalskiPortfolioScreen()
        .preview(withCredentials: true)
}
