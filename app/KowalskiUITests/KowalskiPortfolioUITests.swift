//
//  KowalskiPortfolioUITests.swift
//  KowalskiUITests
//

import KowalskiUtils
import XCTest

@MainActor
final class KowalskiPortfolioUITests: XCTestCase {
    private let portfolioScreenLaunchTimeout: TimeInterval = 20

    private func launchApp(scenario: PortfolioUiTestScenario, resetMoneyVisibility: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
            .enableEnvironmentFlag(for: .isUiTesing)
            .setEnvironment(for: .isUiTestingPortfolioScenario, scenario.rawValue)
        if resetMoneyVisibility {
            app.enableEnvironmentFlag(for: .resetPortfolioMoneyVisibility)
        }
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
        if isTransactionsListVisible(in: app, timeout: 1) {
            return
        }

        openTransactionsList(in: app)
        XCTAssertTrue(isTransactionsListVisible(in: app, timeout: timeout))
    }

    private func assertPortfolioSummaryShown(in app: XCUIApplication, timeout: TimeInterval = 5) {
        XCTAssertTrue(app.buttons["Add entry"].firstMatch.waitForExistenceUsingPredicate(timeout: timeout))
        XCTAssertTrue(
            app.staticTexts["Holdings Net Worth"].firstMatch.waitForExistenceUsingPredicate(timeout: timeout) ||
                app.descendants(matching: .any)
                .matching(identifier: "portfolio-holding-Apple Inc.")
                .firstMatch
                .waitForExistenceUsingPredicate(timeout: timeout),
        )
        XCTAssertFalse(app.buttons["View transactions"].firstMatch.exists)
    }

    private func openTransactionsList(in app: XCUIApplication) {
        if isTransactionsListVisible(in: app, timeout: 0) {
            return
        }

        let transactionsSidebarItem = app.buttons["Transactions"].firstMatch
        XCTAssertTrue(transactionsSidebarItem.waitForExistenceUsingPredicate(timeout: 3))
        transactionsSidebarItem.tap()
    }

    private func openAddTransaction(in app: XCUIApplication) {
        if !app.buttons["Add entry"].firstMatch.exists {
            returnToPortfolioSummary(in: app)
        }

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
        XCTAssertTrue(stockResult.waitForExistenceUsingPredicate(timeout: 15))
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
        if !isTransactionsListVisible(in: app, timeout: 0) {
            openTransactionsList(in: app)
        }

        XCTAssertTrue(tapTransactionRow(named: stockName, in: app, timeout: 3))
    }

    private func tapTransactionRow(named stockName: String, in app: XCUIApplication, timeout: TimeInterval) -> Bool {
        let entryText = transactionRow(named: stockName, in: app)
        if entryText.exists || entryText.waitForExistenceUsingPredicate(timeout: timeout) {
            entryText.tap()
            return true
        }

        let labeledButton = app.buttons[stockName].firstMatch
        if labeledButton.waitForExistenceUsingPredicate(timeout: timeout) {
            labeledButton.tap()
            return true
        }

        return false
    }

    private func assertPairedTransactionPrefill(
        in app: XCUIApplication,
        expectedScreenTitle: String,
        expectedStockLabel: String,
        expectedAmountFieldLabel: String = "Amount",
        expectedAmount: String? = nil,
        expectedTransactionLabel: String,
        expectedPurchasePriceLabel: String? = nil,
        expectedAmountPrefix: String? = nil,
    ) {
        let addTransactionButton = app.buttons["Add Transaction"].firstMatch
        XCTAssertTrue(addTransactionButton.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertTrue(app.staticTexts[expectedScreenTitle].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

        let selectedStockLabel = app.staticTexts[expectedStockLabel].firstMatch
        XCTAssertTrue(selectedStockLabel.waitForExistenceUsingPredicate(timeout: 3))

        let amountField = app.textFields[expectedAmountFieldLabel].firstMatch
        XCTAssertTrue(amountField.waitForExistenceUsingPredicate(timeout: 3))
        if let expectedAmount {
            XCTAssertEqual(amountField.value as? String, expectedAmount)
        }

        if let expectedPurchasePriceLabel {
            XCTAssertTrue(app.staticTexts[expectedPurchasePriceLabel].firstMatch
                .waitForExistenceUsingPredicate(timeout: 3))
        }

        if let expectedAmountPrefix {
            XCTAssertTrue(app.staticTexts[expectedAmountPrefix].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
        }

        let transactionTypePicker = app.popUpButtons["Transaction Type"].firstMatch
        XCTAssertTrue(transactionTypePicker.waitForExistenceUsingPredicate(timeout: 3))
        XCTAssertFalse(transactionTypePicker.isEnabled)
        XCTAssertEqual(transactionTypePicker.value as? String, expectedTransactionLabel)
    }

    private func tapBack(in app: XCUIApplication) {
        let candidates = ["Transaction Details", "Transactions", "Back", "chevron.backward", "AAPL", "TSLA", "NVDA"]

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
            if isTransactionsListVisible(in: app, timeout: 0) {
                return
            }

            tapBack(in: app)
            if isTransactionsListVisible(in: app, timeout: 3) {
                return
            }
        }

        openTransactionsList(in: app)
        if isTransactionsListVisible(in: app, timeout: 3) {
            return
        }

        XCTFail("Expected to return to the transactions list")
    }

    private func returnToPortfolioSummary(in app: XCUIApplication) {
        for _ in 0 ..< 4 {
            if app.staticTexts["Holdings Net Worth"].firstMatch.exists {
                return
            }

            let portfolioSidebarItem = app.buttons["Portfolio"].firstMatch
            XCTAssertTrue(portfolioSidebarItem.waitForExistenceUsingPredicate(timeout: 3))
            portfolioSidebarItem.tap()
            if app.staticTexts["Holdings Net Worth"].firstMatch.waitForExistenceUsingPredicate(timeout: 1) {
                return
            }

            tapBack(in: app)
            if app.staticTexts["Holdings Net Worth"].firstMatch.waitForExistenceUsingPredicate(timeout: 1) {
                return
            }
        }

        XCTFail("Expected to return to the portfolio summary")
    }

    private func isTransactionsListVisible(in app: XCUIApplication, timeout: TimeInterval) -> Bool {
        if app.buttons["Edit"].firstMatch.exists {
            return false
        }

        let transactionsList = app.descendants(matching: .any)
            .matching(identifier: "portfolio-transactions-list")
            .firstMatch
        if transactionsList.exists {
            return true
        }

        let transactionRows = app.staticTexts
            .matching(NSPredicate(format: "label IN %@", ["Apple Inc.", "Tesla, Inc.", "NVIDIA Corporation"]))
        if transactionRows.firstMatch.exists {
            return true
        }

        guard timeout > 0 else { return false }

        return transactionRows.firstMatch.waitForExistenceUsingPredicate(timeout: timeout) ||
            transactionsList.waitForExistenceUsingPredicate(timeout: timeout)
    }

    private func attachScreenshot(named name: String, in app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func assertMoneyVisibilityButton(in app: XCUIApplication, label: String) {
        XCTAssertTrue(app.buttons[label].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
    }

    private func assertHoldingShown(named stockName: String, in app: XCUIApplication) {
        let holding = app.descendants(matching: .any)
            .matching(identifier: "portfolio-holding-\(stockName)")
            .firstMatch
        XCTAssertTrue(holding.waitForExistenceUsingPredicate(timeout: 3))
    }

    private func openHoldingDetail(named stockName: String, symbol: String, in app: XCUIApplication) {
        returnToPortfolioSummary(in: app)

        let holding = app.descendants(matching: .any)
            .matching(identifier: "portfolio-holding-\(stockName)")
            .firstMatch
        XCTAssertTrue(holding.waitForExistenceUsingPredicate(timeout: 3))
        holding.tap()

        let holdingDetail = app.descendants(matching: .any)
            .matching(identifier: "portfolio-holding-detail-\(symbol)")
            .firstMatch
        XCTAssertTrue(holdingDetail.waitForExistenceUsingPredicate(timeout: 3))
    }

    private func assertToastShown(message: String, in app: XCUIApplication, timeout: TimeInterval = 3) {
        let toast = app.descendants(matching: .any)
            .matching(identifier: "toast-\(message)")
            .firstMatch
        XCTAssertTrue(toast.waitForExistenceUsingPredicate(timeout: timeout))
    }

    private func assertTransactionRowShown(named stockName: String, in app: XCUIApplication) {
        if transactionRow(named: stockName, in: app).waitForExistenceUsingPredicate(timeout: 3) {
            return
        }

        XCTAssertTrue(app.staticTexts[stockName].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
    }

    private func transactionRow(named stockName: String, in app: XCUIApplication) -> XCUIElement {
        app.staticTexts[stockName].firstMatch
    }

    func testTransactionCreationFeedbackFlows() {
        continueAfterFailure = false
        let app = launchApp(scenario: .createSequence)

        assertPortfolioSummaryShown(in: app, timeout: 3)
        openTransactionsList(in: app)
        assertTransactionRowShown(named: "Apple Inc.", in: app)

        XCTContext.runActivity(named: "Successful create returns to the list") { _ in
            openAddTransaction(in: app)
            selectAppleStock(in: app)
            replaceAmount(in: app, with: "10")
            app.buttons["Add Transaction"].firstMatch.tap()

            assertTransactionsListShown(in: app)
            XCTAssertFalse(app.buttons["Add Transaction"].firstMatch.exists)
            attachScreenshot(named: "successful-create", in: app)
        }

        XCTContext.runActivity(named: "Generic create failure keeps the editor open") { _ in
            openAddTransaction(in: app)
            selectAppleStock(in: app)
            replaceAmount(in: app, with: "10")
            app.buttons["Add Transaction"].firstMatch.tap()

            assertToastShown(message: "Failed to add transaction", in: app)
            XCTAssertTrue(app.buttons["Add Transaction"].firstMatch.waitForExistenceUsingPredicate(timeout: 2))
        }

        XCTContext.runActivity(named: "Validation failure keeps the editor open") { _ in
            replaceAmount(in: app, with: "0")
            app.buttons["Add Transaction"].firstMatch.tap()

            XCTAssertTrue(app.buttons["Add Transaction"].firstMatch.waitForExistenceUsingPredicate(timeout: 2))
        }
    }

    func testTransactionDetailEditingAndPairedActionFlows() {
        continueAfterFailure = false
        let app = launchApp(scenario: .entries)

        XCTContext.runActivity(named: "Apple split paired action prefill supports back navigation") { _ in
            openTransactionDetail(named: "Apple Inc.", in: app)
            XCTAssertTrue(app.buttons["Split"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Edit"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            app.buttons["Split"].firstMatch.tap()

            assertPairedTransactionPrefill(
                in: app,
                expectedScreenTitle: "Split Transaction",
                expectedStockLabel: "AAPL - Apple Inc. [ISIN: US0378331005] (NASDAQ)",
                expectedAmountFieldLabel: "Ratio",
                expectedTransactionLabel: "Split",
                expectedPurchasePriceLabel: "Price before split",
                expectedAmountPrefix: "1/",
            )

            tapBack(in: app)
            XCTAssertTrue(app.staticTexts["US0378331005"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Split"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            returnToTransactionsList(in: app)
            assertTransactionRowShown(named: "Apple Inc.", in: app)
        }

        XCTContext.runActivity(named: "Apple sell paired action prefill supports back navigation") { _ in
            openTransactionDetail(named: "Apple Inc.", in: app)
            XCTAssertTrue(app.buttons["Split"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

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
            XCTAssertTrue(app.buttons["Split"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            returnToTransactionsList(in: app)
            assertTransactionRowShown(named: "Apple Inc.", in: app)
        }

        XCTContext.runActivity(named: "Tesla paired action can create the opposite transaction") { _ in
            openTransactionDetail(named: "Tesla, Inc.", in: app)
            XCTAssertTrue(app.buttons["Buy"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            app.buttons["Buy"].firstMatch.tap()
            XCTAssertTrue(app.staticTexts["Buy Transaction"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            app.buttons["Add Transaction"].firstMatch.tap()

            assertTransactionsListShown(in: app)
            assertTransactionRowShown(named: "Tesla, Inc.", in: app)
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

            returnToTransactionsList(in: app)
        }

        XCTContext.runActivity(named: "Holding detail shows metrics and related transactions") { _ in
            openHoldingDetail(named: "Apple Inc.", symbol: "AAPL", in: app)

            XCTAssertTrue(app.staticTexts["Allocation"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.staticTexts["Average Buy Price"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(
                app.staticTexts["Current vs Average Cost"].firstMatch.waitForExistenceUsingPredicate(timeout: 3),
            )
            XCTAssertTrue(app.buttons["Buy"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Sell"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            let purchaseTransaction = app.buttons["Purchase, 15 shares"].firstMatch
            XCTAssertTrue(purchaseTransaction.waitForExistenceUsingPredicate(timeout: 3))
            purchaseTransaction.tap()

            XCTAssertTrue(app.staticTexts["US0378331005"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))
            XCTAssertTrue(app.buttons["Split"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

            returnToPortfolioSummary(in: app)
        }

        XCTContext
            .runActivity(named: "Money visibility toggle masks portfolio values and persists across relaunch") { _ in
                returnToPortfolioSummary(in: app)
                assertMoneyVisibilityButton(in: app, label: "Hide money values")
                assertHoldingShown(named: "Apple Inc.", in: app)

                app.buttons["Hide money values"].firstMatch.tap()

                assertMoneyVisibilityButton(in: app, label: "Show money values")
                assertHoldingShown(named: "Apple Inc.", in: app)

                openTransactionDetail(named: "Apple Inc.", in: app)
                XCTAssertFalse(app.staticTexts["USD 150.5"].firstMatch.exists)
                XCTAssertTrue(app.staticTexts["******"].firstMatch.waitForExistenceUsingPredicate(timeout: 3))

                app.terminate()

                let relaunchedApp = launchApp(scenario: .entries, resetMoneyVisibility: false)
                assertMoneyVisibilityButton(in: relaunchedApp, label: "Show money values")
            }
    }
}
