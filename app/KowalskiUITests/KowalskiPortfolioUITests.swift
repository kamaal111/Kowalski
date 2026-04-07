//
//  KowalskiPortfolioUITests.swift
//  KowalskiUITests
//

import KowalskiUtils
import XCTest

@MainActor
final class KowalskiPortfolioUITests: XCTestCase {
    private let portfolioScreenLaunchTimeout: TimeInterval = 20

    private func launchApp(scenario: PortfolioUiTestScenario) -> XCUIApplication {
        let app = XCUIApplication()
            .enableEnvironmentFlag(for: .isUiTesing)
            .setEnvironment(for: .isUiTestingPortfolioScenario, scenario.rawValue)
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launch()
        if !app.buttons["Add entry"].firstMatch
            .waitForExistenceUsingPredicate(timeout: portfolioScreenLaunchTimeout)
        {
            app.typeKey("n", modifierFlags: .command)
            XCTAssertTrue(
                app.buttons["Add entry"].firstMatch
                    .waitForExistenceUsingPredicate(timeout: portfolioScreenLaunchTimeout),
                "Expected the portfolio screen to appear after opening a new window",
            )
        }
        return app
    }

    private func assertTransactionsListShown(in app: XCUIApplication, timeout: TimeInterval = 5) {
        let addEntryButton = app.buttons["Add entry"].firstMatch
        XCTAssertTrue(addEntryButton.waitForExistenceUsingPredicate(timeout: timeout))
    }

    private func openAddTransaction(in app: XCUIApplication) {
        let addEntryButton = app.buttons["Add entry"].firstMatch
        XCTAssertTrue(addEntryButton.waitForExistenceUsingPredicate(timeout: 3))
        addEntryButton.tap()

        let addTransactionButton = app.buttons["Add Transaction"].firstMatch
        XCTAssertTrue(addTransactionButton.waitForExistenceUsingPredicate(timeout: 3))
    }

    private func selectAppleStock(in app: XCUIApplication) {
        let stockSearchField = app.textFields["Symbol or ISIN"].firstMatch
        XCTAssertTrue(stockSearchField.waitForExistenceUsingPredicate(timeout: 3))
        stockSearchField.tap()
        stockSearchField.typeText("AAPL")

        let stockResult = app.buttons["AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)"].firstMatch
        XCTAssertTrue(stockResult.waitForExistenceUsingPredicate(timeout: 5))
        stockResult.tap()
    }

    private func replaceAmount(in app: XCUIApplication, with amount: String) {
        let amountField = app.textFields["Amount"].firstMatch
        XCTAssertTrue(amountField.waitForExistenceUsingPredicate(timeout: 3))
        amountField.tap()
        amountField.typeKey("a", modifierFlags: .command)
        amountField.typeText(amount)
    }

    private func openTransactionDetail(named stockName: String, in app: XCUIApplication) {
        let existingEntry = app.buttons[stockName].firstMatch
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
        let addTransactionButton = app.buttons["Add Transaction"].firstMatch
        XCTAssertTrue(addTransactionButton.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.staticTexts[expectedScreenTitle].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

        let selectedStockLabel = app.staticTexts[expectedStockLabel].firstMatch
        XCTAssertTrue(selectedStockLabel.waitForExistenceUsingPredicate(timeout: 3))

        let amountField = app.textFields["Amount"].firstMatch
        XCTAssertTrue(amountField.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertEqual(amountField.value as? String, expectedAmount)

        let transactionTypePicker = app.popUpButtons["Transaction Type"].firstMatch
        XCTAssertTrue(transactionTypePicker.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertFalse(transactionTypePicker.isEnabled)
        XCTAssertEqual(transactionTypePicker.value as? String, expectedTransactionLabel)
    }

    private func tapBack(in app: XCUIApplication) {
        let candidates = ["Transaction Details", "Transactions", "Back"]

        for button in app.windows.firstMatch.buttons.allElementsBoundByIndex {
            if candidates.contains(button.label) {
                button.tap()
                return
            }
        }

        app.typeKey("[", modifierFlags: .command)
    }

    private func returnToTransactionsList(in app: XCUIApplication) {
        for _ in 0 ..< 3 {
            if app.buttons["Add entry"].firstMatch.exists {
                return
            }

            tapBack(in: app)
            if app.buttons["Add entry"].firstMatch.waitForExistenceUsingPredicate(timeout: 3) {
                return
            }
        }

        XCTFail("Expected to return to the transactions list")
    }

    private func attachScreenshot(named name: String, in app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testTransactionCreationFeedbackFlows() {
        continueAfterFailure = false
        let app = launchApp(scenario: .createSequence)

        assertTransactionsListShown(in: app, timeout: 3)
        XCTAssertTrue(app.buttons["Apple Inc."].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

        XCTContext.runActivity(named: "Successful create returns to the list with a success toast") { _ in
            openAddTransaction(in: app)
            selectAppleStock(in: app)
            replaceAmount(in: app, with: "10")
            app.buttons["Add Transaction"].firstMatch.tap()

            assertTransactionsListShown(in: app)
            XCTAssertFalse(app.buttons["Add Transaction"].firstMatch.exists)
            XCTAssertTrue(
                app.staticTexts["Apple Inc. entry added"].firstMatch
                    .waitForExistenceUsingPredicate(timeout: 3),
            )
            attachScreenshot(named: "success-toast", in: app)
        }

        XCTContext.runActivity(named: "Generic create failure keeps the editor open") { _ in
            openAddTransaction(in: app)
            selectAppleStock(in: app)
            replaceAmount(in: app, with: "10")
            app.buttons["Add Transaction"].firstMatch.tap()

            XCTAssertTrue(
                app.staticTexts["Failed to add transaction"].firstMatch
                    .waitForExistenceUsingPredicate(timeout: 3),
            )
            XCTAssertTrue(app.buttons["Add Transaction"].firstMatch.waitForExistenceUsingPredicate(timeout: 2))
        }

        XCTContext.runActivity(named: "Validation failure keeps the editor open") { _ in
            replaceAmount(in: app, with: "0")
            app.buttons["Add Transaction"].firstMatch.tap()

            XCTAssertTrue(app.staticTexts["amount: Number must be greater than 0"].firstMatch
                .waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Add Transaction"].firstMatch.waitForExistenceUsingPredicate(timeout: 2))
        }
    }

    func testTransactionDetailEditingAndPairedActionFlows() {
        continueAfterFailure = false
        let app = launchApp(scenario: .entries)

        XCTContext.runActivity(named: "Apple paired action prefill supports back navigation") { _ in
            openTransactionDetail(named: "Apple Inc.", in: app)
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Edit"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            app.buttons["Sell"].firstMatch.tap()

            assertPairedTransactionPrefill(
                in: app,
                expectedScreenTitle: "Sell Transaction",
                expectedStockLabel: "AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)",
                expectedAmount: "10",
                expectedTransactionLabel: "Sell",
            )

            tapBack(in: app)
            XCTAssertTrue(app.staticTexts["US0378331005"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            returnToTransactionsList(in: app)
            XCTAssertTrue(app.buttons["Apple Inc."].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
        }

        XCTContext.runActivity(named: "Tesla paired action can create the opposite transaction") { _ in
            openTransactionDetail(named: "Tesla, Inc.", in: app)
            XCTAssertTrue(app.buttons["Buy"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            app.buttons["Buy"].firstMatch.tap()
            XCTAssertTrue(app.staticTexts["Buy Transaction"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            app.buttons["Add Transaction"].firstMatch.tap()

            assertTransactionsListShown(in: app)
            XCTAssertTrue(app.buttons["Tesla, Inc."].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
        }

        XCTContext.runActivity(named: "NVIDIA detail hides opposite transaction actions") { _ in
            openTransactionDetail(named: "NVIDIA Corporation", in: app)
            XCTAssertTrue(app.buttons["Edit"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertFalse(app.buttons["Buy"].firstMatch.exists)
            XCTAssertFalse(app.buttons["Sell"].firstMatch.exists)

            returnToTransactionsList(in: app)
        }

        XCTContext.runActivity(named: "Editing an entry updates the displayed amount") { _ in
            openTransactionDetail(named: "Apple Inc.", in: app)

            let editButton = app.buttons["Edit"].firstMatch
            XCTAssertTrue(editButton.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.staticTexts["US0378331005"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            editButton.tap()

            let saveChangesButton = app.buttons["Save Changes"].firstMatch
            XCTAssertTrue(saveChangesButton.waitForExistenceUsingPredicate(timeout: 3))

            let selectedStockLabel = app.staticTexts["AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)"].firstMatch
            XCTAssertTrue(selectedStockLabel.waitForExistenceUsingPredicate(timeout: 3))

            replaceAmount(in: app, with: "15")
            saveChangesButton.tap()

            XCTAssertTrue(editButton.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.staticTexts["15"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
        }
    }
}
