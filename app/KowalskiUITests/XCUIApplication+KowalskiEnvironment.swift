//
//  XCUIApplication+KowalskiEnvironment.swift
//  KowalskiUITests
//

import KowalskiUtils
import XCTest

extension XCUIApplication {
    @discardableResult
    func setEnvironment(for key: KowalskiEnvironmentKeys, _ value: String) -> XCUIApplication {
        launchEnvironment[key.rawValue] = value
        return self
    }

    @discardableResult
    func enableEnvironmentFlag(for key: KowalskiEnvironmentKeys) -> XCUIApplication {
        setEnvironment(for: key, "1")
    }
}
