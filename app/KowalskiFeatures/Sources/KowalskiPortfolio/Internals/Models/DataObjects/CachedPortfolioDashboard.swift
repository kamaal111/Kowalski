//
//  CachedPortfolioDashboard.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 6/7/26.
//

import Foundation
import KowalskiClient

struct CachedPortfolioDashboard: Codable {
    let sessionEmail: String
    let currencyCode: String
    let period: KowalskiPortfolioDashboardPeriod
    let transactionHash: String
    let dashboards: PortfolioDashboards
    let cachedAt: Date
}
