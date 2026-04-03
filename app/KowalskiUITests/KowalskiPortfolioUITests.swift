//
//  KowalskiPortfolioUITests.swift
//  KowalskiUITests
//

import KowalskiUtils
import XCTest

@MainActor
final class KowalskiPortfolioUITests: XCTestCase {
    private func launchApp(
        failCreateEntry: Bool = false,
        validationFailCreateEntry: Bool = false,
        listEntries: Bool = false,
    ) -> XCUIApplication {
        let app = XCUIApplication().enableEnvironmentFlag(for: .isUiTesing)
        if listEntries {
            app.enableEnvironmentFlag(for: .isUiTestingListEntries)
        }
        if failCreateEntry {
            app.enableEnvironmentFlag(for: .isUiTestingFailCreateEntry)
        }
        if validationFailCreateEntry {
            app.enableEnvironmentFlag(for: .isUiTestingValidationFailCreateEntry)
        }
        app.launch()
        return app
    }

    private func addAppleTransaction(in app: XCUIApplication, amount: String = "10") {
        let addEntryButton = app.buttons["Add entry"]
        XCTAssertTrue(addEntryButton.waitForExistence(timeout: 3))
        addEntryButton.tap()

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistence(timeout: 3))

        let stockSearchField = app.textFields["Symbol or ISIN"]
        XCTAssertTrue(stockSearchField.waitForExistence(timeout: 3))
        stockSearchField.tap()
        stockSearchField.typeText("AAPL")

        let stockResult = app.buttons["AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)"]
        XCTAssertTrue(stockResult.waitForExistence(timeout: 5))
        stockResult.tap()

        let amountField = app.textFields["Amount"]
        XCTAssertTrue(amountField.waitForExistence(timeout: 3))
        amountField.tap()
        amountField.typeText(amount)

        addTransactionButton.tap()
    }

    func testAddTransactionFlowsShowExpectedFeedback() {
        continueAfterFailure = false
        let app = launchApp(listEntries: true)

        let existingEntry = app.staticTexts["Apple Inc."]
        XCTAssertTrue(existingEntry.waitForExistence(timeout: 3))

        addAppleTransaction(in: app)

        let addEntryButton = app.buttons["Add entry"]
        XCTAssertTrue(addEntryButton.waitForExistence(timeout: 5))

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertFalse(addTransactionButton.exists)

        let successToast = app.staticTexts["Apple Inc. entry added"]
        XCTAssertTrue(successToast.waitForExistence(timeout: 3))

        app.terminate()

        let failureApp = launchApp(failCreateEntry: true)

        addAppleTransaction(in: failureApp)

        let errorToast = failureApp.staticTexts["Failed to add transaction"]
        XCTAssertTrue(errorToast.waitForExistence(timeout: 3))

        let failureAddTransactionButton = failureApp.buttons["Add Transaction"]
        XCTAssertTrue(failureAddTransactionButton.waitForExistence(timeout: 2))
    }

    func testServerValidationErrorsShowFieldSpecificFeedback() {
        continueAfterFailure = false
        let app = launchApp(validationFailCreateEntry: true, listEntries: true)

        addAppleTransaction(in: app, amount: "0")

        let errorToast = app.staticTexts["amount: Number must be greater than 0"]
        XCTAssertTrue(errorToast.waitForExistence(timeout: 3))

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistence(timeout: 2))
    }
}
