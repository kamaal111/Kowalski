//
//  KowalskiPortfolioDashboardPeriod.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 6/6/26.
//

import SwiftUI

public enum KowalskiPortfolioDashboardPeriod: String, CaseIterable, Sendable {
    case oneWeek = "1w"
    case oneMonth = "1m"
    case threeMonths = "3m"
    case sixMonths = "6m"
    case yearToDate = "ytd"
    case oneYear = "1y"
    case twoYears = "2y"
    case fiveYears = "5y"
    case tenYears = "10y"
    case all

    public var dashboardLabel: LocalizedStringKey {
        switch self {
        case .oneWeek: "1W"
        case .oneMonth: "1M"
        case .threeMonths: "3M"
        case .sixMonths: "6M"
        case .yearToDate: "YTD"
        case .oneYear: "1Y"
        case .twoYears: "2Y"
        case .fiveYears: "5Y"
        case .tenYears: "10Y"
        case .all: "All"
        }
    }
}
