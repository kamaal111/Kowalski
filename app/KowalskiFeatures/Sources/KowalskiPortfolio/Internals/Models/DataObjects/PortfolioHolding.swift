//
//  PortfolioHolding.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/16/26.
//

struct PortfolioHolding: Hashable {
    let assetType: String
    let asset: PortfolioAsset
    let amount: Double
    let unitValue: Money
    let totalValue: Money
}
