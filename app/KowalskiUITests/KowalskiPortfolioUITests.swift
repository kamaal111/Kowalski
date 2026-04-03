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
        XCTAssertTrue(addEntryButton.waitForExistenceUsingPredicate(timeout: 3))
        addEntryButton.tap()

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistenceUsingPredicate(timeout: 3))

        let stockSearchField = app.textFields["Symbol or ISIN"]
        XCTAssertTrue(stockSearchField.waitForExistenceUsingPredicate(timeout: 3))
        stockSearchField.tap()
        stockSearchField.typeText("AAPL")

        let stockResult = app.buttons["AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)"]
        XCTAssertTrue(stockResult.waitForExistenceUsingPredicate(timeout: 5))
        stockResult.tap()

        let amountField = app.textFields["Amount"]
        XCTAssertTrue(amountField.waitForExistenceUsingPredicate(timeout: 3))
        amountField.tap()
        amountField.typeText(amount)

        addTransactionButton.tap()
    }

    func testAddTransactionFlowsShowExpectedFeedback() {
        continueAfterFailure = false
        let app = launchApp(listEntries: true)

        let existingEntry = app.buttons["Apple Inc."]
        XCTAssertTrue(existingEntry.waitForExistenceUsingPredicate(timeout: 3))

        addAppleTransaction(in: app)

        let addEntryButton = app.buttons["Add entry"]
        XCTAssertTrue(addEntryButton.waitForExistenceUsingPredicate(timeout: 5))

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertFalse(addTransactionButton.exists)

        let successToast = app.staticTexts["Apple Inc. entry added"]
        XCTAssertTrue(successToast.waitForExistenceUsingPredicate(timeout: 3))

        app.terminate()

        let failureApp = launchApp(failCreateEntry: true)

        addAppleTransaction(in: failureApp)

        let errorToast = failureApp.staticTexts["Failed to add transaction"]
        XCTAssertTrue(errorToast.waitForExistenceUsingPredicate(timeout: 3))

        let failureAddTransactionButton = failureApp.buttons["Add Transaction"]
        XCTAssertTrue(failureAddTransactionButton.waitForExistenceUsingPredicate(timeout: 2))
    }

    func testServerValidationErrorsShowFieldSpecificFeedback() {
        continueAfterFailure = false
        let app = launchApp(validationFailCreateEntry: true, listEntries: true)

        addAppleTransaction(in: app, amount: "0")

        let errorToast = app.staticTexts["amount: Number must be greater than 0"]
        XCTAssertTrue(errorToast.waitForExistenceUsingPredicate(timeout: 3))

        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistenceUsingPredicate(timeout: 2))
    }

    func testTransactionDetailScreenSupportsEditing() {
        continueAfterFailure = false
        let app = launchApp(listEntries: true)

        let existingEntry = app.buttons["Apple Inc."]
        XCTAssertTrue(existingEntry.waitForExistenceUsingPredicate(timeout: 3))
        existingEntry.tap()

        let editButton = app.buttons["Edit"]
        XCTAssertTrue(editButton.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.staticTexts["US0378331005"].waitForExistenceUsingPredicate(timeout: 3))

        editButton.tap()

        let saveChangesButton = app.buttons["Save Changes"]
        XCTAssertTrue(saveChangesButton.waitForExistenceUsingPredicate(timeout: 3))

        let selectedStockLabel = app.staticTexts["AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)"]
        XCTAssertTrue(selectedStockLabel.waitForExistenceUsingPredicate(timeout: 3))

        let amountField = app.textFields["Amount"]
        XCTAssertTrue(amountField.waitForExistenceUsingPredicate(timeout: 3))
        amountField.tap()
        amountField.typeKey("a", modifierFlags: .command)
        amountField.typeText("15")

        saveChangesButton.tap()

        XCTAssertTrue(editButton.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.staticTexts["15"].waitForExistenceUsingPredicate(timeout: 3))
    }
}
