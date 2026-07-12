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
    let portfolioHoldingsDistribution: PortfolioHoldingsDistribution
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

struct PortfolioHoldingsDistribution: Codable, Hashable {
    let currency: KowalskiCurrency
    let holdings: [PortfolioHoldingDistributionItem]
}

struct PortfolioHoldingDistributionItem: Codable, Hashable {
    let symbol: String
    let name: String
    let marketValue: Money
}
