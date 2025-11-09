//
//  KowalskiScene.swift
//  KowalskiApp
//
//  Created by Kamaal M Farah on 9/7/25.
//

import SwiftUI
import KowalskiAuth
import KowalskiPortfolio

public struct KowalskiScene: Scene {
    @State private var auth = KowalskiAuth.default()
    @State private var portfolio = KowalskiPortfolio.default()

    public init() { }

    public var body: some Scene {
        WindowGroup {
            NavigationStack {
                KowalskiPortfolioScreen()
            }
            .kowalskiAuth(auth)
            .kowalskiPortfolio(portfolio)
        }
    }
}
