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

    private func openTransactionDetail(named stockName: String, in app: XCUIApplication) {
        let existingEntry = app.buttons[stockName]
        XCTAssertTrue(existingEntry.waitForExistenceUsingPredicate(timeout: 3))
        existingEntry.tap()
    }

    private func assertPairedTransactionPrefill(
        in app: XCUIApplication,
        expectedScreenTitle: String,
        expectedStockLabel: String,
        expectedAmount: String,
        expectedTransactionLabel: String,
    ) {
        let addTransactionButton = app.buttons["Add Transaction"]
        XCTAssertTrue(addTransactionButton.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.staticTexts[expectedScreenTitle].waitForExistenceUsingPredicate(timeout: 3))

        let selectedStockLabel = app.staticTexts[expectedStockLabel]
        XCTAssertTrue(selectedStockLabel.waitForExistenceUsingPredicate(timeout: 3))

        let amountField = app.textFields["Amount"]
        XCTAssertTrue(amountField.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertEqual(amountField.value as? String, expectedAmount)

        let transactionTypePicker = app.popUpButtons["Transaction Type"]
        XCTAssertTrue(transactionTypePicker.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertFalse(transactionTypePicker.isEnabled)
        XCTAssertEqual(transactionTypePicker.value as? String, expectedTransactionLabel)
    }

    private func tapBack(in app: XCUIApplication) {
        let candidates = ["Transaction Details", "Transactions", "Back"]

        for button in app.buttons.allElementsBoundByIndex {
            if candidates.contains(button.label) {
                button.tap()
                return
            }
        }

        app.typeKey("[", modifierFlags: .command)
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

        failureApp.terminate()

        let validationApp = launchApp(validationFailCreateEntry: true, listEntries: true)

        addAppleTransaction(in: validationApp, amount: "0")

        let validationErrorToast = validationApp.staticTexts["amount: Number must be greater than 0"]
        XCTAssertTrue(validationErrorToast.waitForExistenceUsingPredicate(timeout: 3))

        let validationAddTransactionButton = validationApp.buttons["Add Transaction"]
        XCTAssertTrue(validationAddTransactionButton.waitForExistenceUsingPredicate(timeout: 2))
    }

    func testTransactionDetailScreenSupportsEditing() {
        continueAfterFailure = false
        let app = launchApp(listEntries: true)

        openTransactionDetail(named: "Apple Inc.", in: app)

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

    func testPairedTransactionDetailCanCreateOppositeTransaction() {
        continueAfterFailure = false
        let app = launchApp(listEntries: true)

        let scenarios = [
            (
                sourceStockName: "Apple Inc.",
                pairedActionTitle: "Sell",
                expectedStockLabel: "AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)",
                expectedAmount: "10",
                expectedTransactionLabel: "Sell",
            ),
            (
                sourceStockName: "Tesla, Inc.",
                pairedActionTitle: "Buy",
                expectedStockLabel: "TSLA - Tesla, Inc. [ISIN: US88160R1014] (NASDAQ)",
                expectedAmount: "7",
                expectedTransactionLabel: "Purchase",
            ),
        ]

        for scenario in scenarios {
            openTransactionDetail(named: scenario.sourceStockName, in: app)

            let pairedActionButton = app.buttons[scenario.pairedActionTitle]
            XCTAssertTrue(pairedActionButton.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Edit"].waitForExistenceUsingPredicate(timeout: 3))

            pairedActionButton.tap()

            assertPairedTransactionPrefill(
                in: app,
                expectedScreenTitle: scenario.pairedActionTitle + " Transaction",
                expectedStockLabel: scenario.expectedStockLabel,
                expectedAmount: scenario.expectedAmount,
                expectedTransactionLabel: scenario.expectedTransactionLabel,
            )

            app.buttons["Add Transaction"].tap()

            let addEntryButton = app.buttons["Add entry"]
            XCTAssertTrue(addEntryButton.waitForExistenceUsingPredicate(timeout: 5))
            XCTAssertFalse(app.buttons["Edit"].exists)
            XCTAssertTrue(app.buttons[scenario.sourceStockName].waitForExistenceUsingPredicate(timeout: 3))
        }
    }

    func testTransactionDetailFlowsCoverOppositeTransactionActionsAndNavigation() {
        continueAfterFailure = false
        let app = launchApp(listEntries: true)

        openTransactionDetail(named: "Apple Inc.", in: app)
        XCTAssertTrue(app.buttons["Sell"].waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.buttons["Edit"].waitForExistenceUsingPredicate(timeout: 3))
        app.buttons["Sell"].tap()
        XCTAssertTrue(app.buttons["Add Transaction"].waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.staticTexts["Sell Transaction"].waitForExistenceUsingPredicate(timeout: 3))
        tapBack(in: app)
        XCTAssertTrue(app.staticTexts["US0378331005"].waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.buttons["Sell"].waitForExistenceUsingPredicate(timeout: 3))

        tapBack(in: app)
        XCTAssertTrue(app.buttons["Apple Inc."].waitForExistenceUsingPredicate(timeout: 3))

        openTransactionDetail(named: "Tesla, Inc.", in: app)
        XCTAssertTrue(app.buttons["Buy"].waitForExistenceUsingPredicate(timeout: 3))
        app.buttons["Buy"].tap()
        assertPairedTransactionPrefill(
            in: app,
            expectedScreenTitle: "Buy Transaction",
            expectedStockLabel: "TSLA - Tesla, Inc. [ISIN: US88160R1014] (NASDAQ)",
            expectedAmount: "7",
            expectedTransactionLabel: "Purchase",
        )
        app.buttons["Add Transaction"].tap()

        XCTAssertTrue(app.buttons["Add entry"].waitForExistenceUsingPredicate(timeout: 5))
        XCTAssertTrue(app.buttons["Tesla, Inc."].waitForExistenceUsingPredicate(timeout: 3))

        openTransactionDetail(named: "NVIDIA Corporation", in: app)
        XCTAssertTrue(app.buttons["Edit"].waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertFalse(app.buttons["Buy"].exists)
        XCTAssertFalse(app.buttons["Sell"].exists)
    }
}
