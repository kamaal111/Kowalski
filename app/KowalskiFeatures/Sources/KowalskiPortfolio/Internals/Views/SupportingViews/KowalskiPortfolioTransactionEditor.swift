//
//  KowalskiPortfolioTransactionEditor.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 4/3/26.
//

import ForexKit
import KamaalExtensions
import KamaalLogger
import KamaalUI
import KowalskiDesignSystem
import KowalskiUtils
import SwiftUI

private let logger = KamaalLogger(
    from: KowalskiPortfolioTransactionEditor<Void>.self,
    failOnError: !KowalskiEnvironment.isUiTesting,
)

struct KowalskiPortfolioTransactionEditor<SuccessValue: Sendable>: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    @FocusState private var focusedTextfield: EntryScreenFocusFields?

    @State private var selectedStock: Stock?
    @State private var amount: String
    @State private var amountError: KowalskiTextFieldErrorResult?
    @State private var purchasePriceCurrency: Currencies
    @State private var purchasePriceValue: String
    @State private var transactionType: TransactionType
    @State private var transactionDate: Date

    private let autofocusAmountField: Bool
    private let configuration: KowalskiPortfolioTransactionEditorConfiguration
    private let submitButtonTitle: LocalizedStringResource
    private let onSubmit: (_ formPayload: TransactionPayload) async -> Result<SuccessValue, Error>
    private let onFailure: @MainActor (_ error: Error) -> Void
    private let onSuccess: @MainActor (_ successValue: SuccessValue, _ formPayload: TransactionPayload) -> Void

    init(
        initialValues: KowalskiPortfolioTransactionFormValues,
        autofocusAmountField: Bool = true,
        configuration: KowalskiPortfolioTransactionEditorConfiguration = .default,
        submitButtonTitle: LocalizedStringResource,
        onSubmit: @escaping (_ formPayload: TransactionPayload) async -> Result<SuccessValue, Error>,
        onFailure: @escaping @MainActor (_ error: Error) -> Void = { _ in },
        onSuccess: @escaping @MainActor (_ successValue: SuccessValue, _ formPayload: TransactionPayload) -> Void,
    ) {
        _selectedStock = State(initialValue: initialValues.selectedStock)
        _amount = State(initialValue: initialValues.amount)
        _purchasePriceCurrency = State(initialValue: initialValues.purchasePriceCurrency)
        _purchasePriceValue = State(initialValue: initialValues.purchasePriceValue)
        _transactionType = State(initialValue: configuration.fixedTransactionType ?? initialValues.transactionType)
        _transactionDate = State(initialValue: initialValues.transactionDate)
        self.autofocusAmountField = autofocusAmountField
        self.configuration = configuration
        self.submitButtonTitle = submitButtonTitle
        self.onSubmit = onSubmit
        self.onFailure = onFailure
        self.onSuccess = onSuccess
    }

    var body: some View {
        VStack {
            KowalskiSearchableDropdown(
                selectedItem: $selectedStock,
                localizedTitle: "Symbol or ISIN",
                itemLabel: stockSearchLabel,
                onSearch: { query in
                    await portfolio.searchStocks(query: query)
                },
            )
            .disabled(!configuration.stockSelectionIsEnabled)
            MoneyField(
                currency: $purchasePriceCurrency,
                value: $purchasePriceValue,
                title: NSLocalizedString("Purchase price", comment: ""),
                currencies: Currencies.allCases,
                fixButtonTitle: NSLocalizedString("Fix", comment: ""),
                fixMessage: "Invalid value",
            )
            KowalskiTextField(
                text: $amount,
                errorResult: $amountError,
                localizedTitle: "Amount",
                variant: .decimals(locale: ModuleConfig.defaultLocale),
                validations: [
                    .numeric(
                        locale: ModuleConfig.defaultLocale,
                        greaterThanOrEqualTo: 0,
                        message: NSLocalizedString("Amount should be numeric", comment: ""),
                    ),
                ],
            )
            .focused($focusedTextfield, equals: .amount)
            .onSubmit(handleSubmit)
            HStack {
                Picker(
                    selection: $transactionType,
                    content: {
                        ForEach(TransactionType.allCases, id: \.self) { type in
                            Text(type.label)
                                .tag(type)
                        }
                    },
                    label: {
                        Text(transactionTypeAccessibilityLabel)
                    },
                )
                .labelsHidden()
                .pickerStyle(.menu)
                .disabled(configuration.fixedTransactionType != nil)
                .accessibilityIdentifier(transactionTypeAccessibilityLabel)
                .accessibilityLabel(Text(transactionTypeAccessibilityLabel))
                DatePicker("", selection: $transactionDate, displayedComponents: .date)
                    .labelsHidden()
            }
            .padding(.vertical, .small)
            .ktakeWidthEagerly(alignment: .leading)
            Button(action: handleSubmit) {
                Text(submitButtonTitle)
                    .ktakeWidthEagerly()
            }
            .disabled(!submissionIsEnabled)
        }
        .onAppear(perform: handleOnAppear)
    }

    private var submissionIsEnabled: Bool {
        formIsValid
    }

    private var formPayload: TransactionPayload? {
        guard submissionIsEnabled else { return nil }
        guard let stock = selectedStock else { return nil }

        let amount = amount.nsString?.doubleValue
        assert(amount != nil)

        let purchasePriceValue = purchasePriceValue.nsString?.doubleValue
        assert(purchasePriceValue != nil)

        let money = Money(currency: purchasePriceCurrency, value: purchasePriceValue ?? 0)

        return TransactionPayload(
            stock: stock,
            amount: amount ?? 1,
            purchasePrice: money,
            transactionType: transactionType,
            transactionDate: transactionDate,
        )
    }

    private var textFieldErrors: [KowalskiTextFieldErrorResult] {
        [amountError]
            .compactMap(\.self)
    }

    private var purchasePriceDoubleValue: Double {
        guard let purchaseDoubleValue = purchasePriceValue.nsString?.doubleValue else {
            let message = "Expecting purchase value to be a valid double"
            logger.error(message)
            return 0
        }
        return purchaseDoubleValue
    }

    private var formValidity: Result<Void, FormInvalidityErrors> {
        if selectedStock == nil {
            return .failure(.noStockSelected)
        }

        let firstTextFieldErrorThatIsNotValid = textFieldErrors.find(by: \.isValid, is: false)
        if let firstTextFieldErrorThatIsNotValid {
            assert(firstTextFieldErrorThatIsNotValid.errorMessage != nil)
            return .failure(.textField(message: firstTextFieldErrorThatIsNotValid.errorMessage ?? ""))
        }

        if purchasePriceDoubleValue < 0 {
            return .failure(.purchasePrice)
        }

        return .success(())
    }

    private var formIsValid: Bool {
        (try? formValidity.get()) != nil
    }

    private func handleSubmit() {
        guard submissionIsEnabled else { return }
        guard let formPayload else {
            let message = "After that the form is valid, we should have had payload"
            logger.error(message)
            return
        }

        Task { @MainActor in
            let result = await onSubmit(formPayload)

            switch result {
            case let .failure(failure):
                logger.error(label: "Failed to submit transaction", error: failure)
                onFailure(failure)
            case let .success(successValue):
                onSuccess(successValue, formPayload)
            }
        }
    }

    private func handleOnAppear() {
        guard autofocusAmountField else { return }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            focusedTextfield = .amount
        }
    }

    private func stockSearchLabel(_ stock: Stock) -> String {
        let exchange = stock.exchangeDispatch ?? stock.exchange
        let isinLabel = if let isin = stock.isin {
            " [ISIN: \(isin)]"
        } else {
            ""
        }

        return "\(stock.symbol) - \(stock.name)\(isinLabel) (\(exchange))"
    }

    private var transactionTypeAccessibilityLabel: String {
        NSLocalizedString("Transaction Type", comment: "")
    }
}

struct KowalskiPortfolioTransactionEditorConfiguration {
    let stockSelectionIsEnabled: Bool
    let fixedTransactionType: TransactionType?

    static let `default` = KowalskiPortfolioTransactionEditorConfiguration(
        stockSelectionIsEnabled: true,
        fixedTransactionType: nil,
    )

    static func pairedCreate(transactionType: TransactionType) -> KowalskiPortfolioTransactionEditorConfiguration {
        KowalskiPortfolioTransactionEditorConfiguration(
            stockSelectionIsEnabled: false,
            fixedTransactionType: transactionType,
        )
    }
}

struct KowalskiPortfolioTransactionFormValues {
    let selectedStock: Stock?
    let amount: String
    let purchasePriceCurrency: Currencies
    let purchasePriceValue: String
    let transactionType: TransactionType
    let transactionDate: Date

    static func empty(preferredCurrency: Currencies = .USD) -> KowalskiPortfolioTransactionFormValues {
        KowalskiPortfolioTransactionFormValues(
            selectedStock: nil,
            amount: "",
            purchasePriceCurrency: preferredCurrency,
            purchasePriceValue: "0",
            transactionType: .purchase,
            transactionDate: .now,
        )
    }

    init(
        selectedStock: Stock?,
        amount: String,
        purchasePriceCurrency: Currencies,
        purchasePriceValue: String,
        transactionType: TransactionType,
        transactionDate: Date,
    ) {
        self.selectedStock = selectedStock
        self.amount = amount
        self.purchasePriceCurrency = purchasePriceCurrency
        self.purchasePriceValue = purchasePriceValue
        self.transactionType = transactionType
        self.transactionDate = transactionDate
    }

    init(entry: PortfolioEntry) {
        self.init(
            selectedStock: entry.stock,
            amount: Self.formattedNumber(entry.amount),
            purchasePriceCurrency: entry.purchasePrice.currency,
            purchasePriceValue: Self.formattedNumber(entry.purchasePrice.value),
            transactionType: entry.transactionType,
            transactionDate: entry.transactionDate,
        )
    }

    static func pairedCreate(
        from entry: PortfolioEntry,
        transactionType: TransactionType,
        preferredCurrency: Currencies = .USD,
    ) -> Self {
        let emptyValues = empty(preferredCurrency: preferredCurrency)

        return Self(
            selectedStock: entry.stock,
            amount: formattedNumber(entry.amount),
            purchasePriceCurrency: emptyValues.purchasePriceCurrency,
            purchasePriceValue: emptyValues.purchasePriceValue,
            transactionType: transactionType,
            transactionDate: emptyValues.transactionDate,
        )
    }

    private static func formattedNumber(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0 ... 6)))
    }
}

private enum FormInvalidityErrors: Error {
    case noStockSelected
    case textField(message: String)
    case purchasePrice

    var errorDescription: String? {
        switch self {
        case .noStockSelected: NSLocalizedString("Please select a stock", comment: "")
        case let .textField(message): message
        case .purchasePrice: NSLocalizedString("Invalid purchase price", comment: "")
        }
    }
}

private enum EntryScreenFocusFields {
    case amount
}
