//
//  KowalskiPortfolioHoldingsPreflightResponse.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 5/17/26.
//

public struct KowalskiPortfolioHoldingsPreflightResponse: Equatable, Sendable {
    public let refreshState: RefreshState
    public let pollAfterMilliseconds: Int?
    public let latestCachedPriceDate: String?

    public init(refreshState: RefreshState, pollAfterMilliseconds: Int?, latestCachedPriceDate: String?) {
        self.refreshState = refreshState
        self.pollAfterMilliseconds = pollAfterMilliseconds
        self.latestCachedPriceDate = latestCachedPriceDate
    }

    public enum RefreshState: String, Sendable {
        case ready
        case refreshing
    }
}
