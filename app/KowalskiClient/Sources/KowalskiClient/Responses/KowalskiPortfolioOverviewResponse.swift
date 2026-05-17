//
//  KowalskiPortfolioOverviewResponse.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 4/12/26.
//

public struct KowalskiPortfolioOverviewResponse: Sendable {
    public let transactions: [KowalskiPortfolioClientEntryResponse]
    public let currentValues: [String: KowalskiClientMoney]
    public let holdings: [KowalskiPortfolioHoldingResponse]
    public let netWorth: KowalskiClientMoney

    public init(
        transactions: [KowalskiPortfolioClientEntryResponse],
        currentValues: [String: KowalskiClientMoney],
        holdings: [KowalskiPortfolioHoldingResponse],
        netWorth: KowalskiClientMoney,
    ) {
        self.transactions = transactions
        self.currentValues = currentValues
        self.holdings = holdings
        self.netWorth = netWorth
    }
}
