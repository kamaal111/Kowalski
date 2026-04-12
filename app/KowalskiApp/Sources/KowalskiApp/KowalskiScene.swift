//
//  KowalskiScene.swift
//  KowalskiApp
//
//  Created by Kamaal M Farah on 9/7/25.
//

import KowalskiAuth
import KowalskiClient
import KowalskiPortfolio
import SwiftUI

public struct KowalskiScene: Scene {
    @State private var auth = KowalskiAuth.forEnvironment()
    @State private var portfolio = KowalskiPortfolio.forEnvironment()

    public init() {}

    public var body: some Scene {
        WindowGroup {
            NavigationStack {
                KowalskiPortfolioScreen()
            }
            .kowalskiAuth(auth)
            .kowalskiPortfolio(portfolio)
        }
        Settings {
            KowalskiAuthSettingsView(
                onExportTransactions: {
                    await portfolio.exportTransactions().mapError { error in error as any Error }
                },
                onImportTransactions: { url in
                    await portfolio.importTransactions(from: url).mapError { error in error as any Error }
                },
                onDownloadTransactionsTemplate: {
                    await portfolio.downloadTransactionsTemplate().mapError { error in error as any Error }
                },
            )
            .environment(auth)
            .kowalskiPortfolio(portfolio)
        }
    }
}
