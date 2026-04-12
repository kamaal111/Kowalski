//
//  KowalskiPortfolioOverviewResponse.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 4/12/26.
//

public struct KowalskiPortfolioOverviewResponse: Sendable {
    public let transactions: [KowalskiPortfolioClientEntryResponse]
    public let currentValues: [String: KowalskiClientMoney]
}
