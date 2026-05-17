//
//  PortfolioAsset.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/16/26.
//

struct PortfolioAsset: Codable, Hashable {
    let symbol: String
    let exchange: String
    let name: String
    let isin: String?
    let sector: String?
    let industry: String?
    let exchangeDispatch: String?
}
