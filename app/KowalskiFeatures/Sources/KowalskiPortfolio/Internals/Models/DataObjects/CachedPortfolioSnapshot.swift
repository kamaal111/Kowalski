//
//  CachedPortfolioSnapshot.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/17/26.
//

import Foundation

struct CachedPortfolioSnapshot: Codable {
    let sessionEmail: String
    let currencyCode: String
    let entries: [PortfolioEntry]
    let holdings: [PortfolioHolding]
    let netWorth: Money?
    let cachedAt: Date
}
