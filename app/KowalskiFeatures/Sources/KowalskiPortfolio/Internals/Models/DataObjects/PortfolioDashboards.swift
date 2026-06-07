//
//  PortfolioDashboards.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import Foundation
import KowalskiModels

struct PortfolioDashboards: Codable, Hashable {
    let portfolioGrowthOverTime: PortfolioGrowthOverTime
}

struct PortfolioGrowthOverTime: Codable, Hashable {
    let currency: KowalskiCurrency
    let points: [PortfolioGrowthPoint]
}

struct PortfolioGrowthPoint: Codable, Hashable {
    let date: Date
    let value: Double
    let isCurrent: Bool
}
