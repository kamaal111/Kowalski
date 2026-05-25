//
//  KowalskiPortfolioDashboardsResponse.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 5/25/26.
//

import Foundation
import KowalskiModels

public struct KowalskiPortfolioDashboardsResponse: Sendable {
    public let portfolioGrowthOverTime: KowalskiPortfolioGrowthOverTimeResponse
}

public struct KowalskiPortfolioGrowthOverTimeResponse: Sendable {
    public let currency: KowalskiCurrency
    public let points: [KowalskiPortfolioGrowthPointResponse]
}

public struct KowalskiPortfolioGrowthPointResponse: Sendable, Hashable {
    public let date: Date
    public let value: Double
    public let isCurrent: Bool
}
