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

    public init(
        assetType: String,
        asset: KowalskiPortfolioAssetResponse,
        amount: Double,
        unitValue: KowalskiClientMoney,
        totalValue: KowalskiClientMoney,
    ) {
        self.assetType = assetType
        self.asset = asset
        self.amount = amount
        self.unitValue = unitValue
        self.totalValue = totalValue
    }
}

public struct KowalskiPortfolioAssetResponse: Sendable {
    public let symbol: String
    public let exchange: String
    public let name: String
    public let isin: String?
    public let sector: String?
    public let industry: String?
    public let exchangeDispatch: String?

    public init(
        symbol: String,
        exchange: String,
        name: String,
        isin: String?,
        sector: String?,
        industry: String?,
        exchangeDispatch: String?,
    ) {
        self.symbol = symbol
        self.exchange = exchange
        self.name = name
        self.isin = isin
        self.sector = sector
        self.industry = industry
        self.exchangeDispatch = exchangeDispatch
    }
}
