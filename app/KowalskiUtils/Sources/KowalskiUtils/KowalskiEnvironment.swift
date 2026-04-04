//
//  KowalskiEnvironment.swift
//  KowalskiUtils
//
//  Created by Kamaal M Farah on 3/28/26.
//

import Foundation

public enum PortfolioUiTestScenario: String, Sendable {
    case entries
    case createSequence = "create-sequence"
    case listFailure = "list-failure"
}

public enum KowalskiEnvironment {
    public static let isUiTesting = ProcessInfo.processInfo[.isUiTesing] == "1"
    public static let portfolioUiTestScenario =
        ProcessInfo.processInfo[.isUiTestingPortfolioScenario]
            .flatMap(PortfolioUiTestScenario.init(rawValue:))
}

public enum KowalskiEnvironmentKeys: String {
    case isUiTesing = "IS_UI_TESTING"
    case isUiTestingPortfolioScenario = "IS_UI_TESTING_PORTFOLIO_SCENARIO"
}

public extension ProcessInfo {
    subscript(env: KowalskiEnvironmentKeys) -> String? {
        environment[env.rawValue]
    }
}
