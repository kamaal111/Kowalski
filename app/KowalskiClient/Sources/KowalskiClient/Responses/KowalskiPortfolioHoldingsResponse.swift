//
//  KowalskiPortfolioHoldingsResponse.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 5/16/26.
//

public struct KowalskiPortfolioHoldingResponse: Sendable {
    public let assetType: String
    public let asset: KowalskiPortfolioAssetResponse
    public let amount: Double
    public let unitValue: KowalskiClientMoney
    public let totalValue: KowalskiClientMoney
    public let profitLoss: KowalskiPortfolioHoldingProfitLossResponse?
}

public struct KowalskiPortfolioHoldingProfitLossResponse: Sendable {
    public let amount: KowalskiClientMoney
    public let percentage: Double?
}

public struct KowalskiPortfolioAssetResponse: Sendable {
    public let symbol: String
    public let exchange: String
    public let name: String
    public let isin: String?
    public let sector: String?
    public let industry: String?
    public let exchangeDispatch: String?
}
