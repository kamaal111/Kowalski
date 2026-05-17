//
//  PortfolioHolding.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/16/26.
//

struct PortfolioHolding: Codable, Hashable {
    let assetType: String
    let asset: PortfolioAsset
    let amount: Double
    let unitValue: Money
    let totalValue: Money
    let profitLoss: PortfolioHoldingProfitLoss?
}

struct PortfolioHoldingProfitLoss: Codable, Hashable {
    let amount: Money
    let percentage: Double?
}
