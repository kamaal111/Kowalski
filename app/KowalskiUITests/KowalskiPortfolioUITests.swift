//
//  KowalskiPortfolioUITests.swift
//  KowalskiUITests
//

import KowalskiUtils
import XCTest

@MainActor
final class KowalskiPortfolioUITests: XCTestCase {
    private func launchApp(failCreateEntry: Bool = false) -> XCUIApplication {
        let app = XCUIApplication().enableEnvironmentFlag(for: .isUiTesing)
        if failCreateEntry {
            app.enableEnvironmentFlag(for: .isUiTestingFailCreateEntry)
        }
        app.launch()
        return app
    }

    func testAddTransactionSuccessNavigatesBackAndShowsToast() {
        continueAfterFailure = false
        let app = launchApp()

        let addEntryButton = app.buttons["Add entry"]
        XCTAssertTrue(addEntryButton.waitForExistence(timeout: 3))
        addEntryButton.tap()

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistence(timeout: 3))

        let stockSearchField = app.textFields["Symbol or ISIN"]
        XCTAssertTrue(stockSearchField.waitForExistence(timeout: 3))
        stockSearchField.tap()
        stockSearchField.typeText("AAPL")

        let stockResult = app.buttons["AAPL - Apple Inc. (NASDAQ)"]
        XCTAssertTrue(stockResult.waitForExistence(timeout: 5))
        stockResult.tap()

        let amountField = app.textFields["Amount"]
        XCTAssertTrue(amountField.waitForExistence(timeout: 3))
        amountField.tap()
        amountField.typeText("10")

        addTransactionButton.tap()

        XCTAssertTrue(addEntryButton.waitForExistence(timeout: 5))
        XCTAssertFalse(addTransactionButton.exists)

        let successToast = app.staticTexts["Apple Inc. entry added"]
        XCTAssertTrue(successToast.waitForExistence(timeout: 3))
    }

    func testAddTransactionFailureStaysOnScreenAndShowsErrorToast() {
        continueAfterFailure = false
        let app = launchApp(failCreateEntry: true)

        let addEntryButton = app.buttons["Add entry"]
        XCTAssertTrue(addEntryButton.waitForExistence(timeout: 3))
        addEntryButton.tap()

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistence(timeout: 3))

        let stockSearchField = app.textFields["Symbol or ISIN"]
        XCTAssertTrue(stockSearchField.waitForExistence(timeout: 3))
        stockSearchField.tap()
        stockSearchField.typeText("AAPL")

        let stockResult = app.buttons["AAPL - Apple Inc. (NASDAQ)"]
        XCTAssertTrue(stockResult.waitForExistence(timeout: 5))
        stockResult.tap()

        let amountField = app.textFields["Amount"]
        XCTAssertTrue(amountField.waitForExistence(timeout: 3))
        amountField.tap()
        amountField.typeText("10")

        addTransactionButton.tap()

        let errorToast = app.staticTexts["Failed to add transaction"]
        XCTAssertTrue(errorToast.waitForExistence(timeout: 3))

        XCTAssertTrue(addTransactionButton.waitForExistence(timeout: 2))
    }
}
