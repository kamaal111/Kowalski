//
//  KowalskiPortfolioTransactionScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/2/25.
//

import SwiftUI
import ForexKit
import KamaalUI
import KamaalLogger
import KamaalExtensions
import KowalskiDesignSystem

private let logger = KamaalLogger(from: KowalskiPortfolioTransactionScreen.self, failOnError: true)

struct KowalskiPortfolioTransactionScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    @FocusState private var focusedTextfield: EntryScreenFocusFields?

    @State private var selectedStock: Stock?
    @State private var amount = ""
    @State private var amountError: KowalskiTextFieldErrorResult?
    @State private var purchasePriceCurrency: Currencies = .USD
    @State private var purchasePriceValue = "0"
    @State private var transactionType: TransactionType = .purchase
    @State private var transactionDate: Date = .now

    var body: some View {
        KFormBox(title: NSLocalizedString("Add Entry", comment: ""), minSize: ModuleConfig.screenMinSize) {
            VStack {
                KowalskiSearchableDropdown(
                    selectedItem: $selectedStock,
                    localizedTitle: "Symbol or ISIN",
                    itemLabel: { stock in
                        let exchange = stock.exchangeDispatch ?? stock.exchange
                        return "\(stock.symbol) - \(stock.name) (\(exchange))"
                    },
                    onSearch: { query in
                        await portfolio.searchStocks(query: query)
                    }
                )
                MoneyField(
                    currency: $purchasePriceCurrency,
                    value: $purchasePriceValue,
                    title: NSLocalizedString("Purchase price", comment: ""),
                    currencies: Currencies.allCases,
                    fixButtonTitle: NSLocalizedString("Fix", comment: ""),
                    fixMessage: "Invalid value"
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
                            message: NSLocalizedString("Amount should be numeric", comment: "")
                        )
                    ]
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
                            EmptyView()
                        }
                    )
                    .labelsHidden()
                    .pickerStyle(.menu)
                    DatePicker("", selection: $transactionDate, displayedComponents: .date)
                        .labelsHidden()
                }
                .padding(.vertical, .small)
                .ktakeWidthEagerly(alignment: .leading)
            }
        }
        .navigationTitle("Add Transaction")
        .onAppear(perform: handleOnAppear)
    }

    private var formPayload: TransactionPayload? {
        guard formIsValid else { return nil }
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
            transactionDate: transactionDate
        )
    }

    private var textFieldErrors: [KowalskiTextFieldErrorResult] {
        [amountError]
            .compactMap { $0 }
    }

    private var purchasePriceDoubleValue: Double {
        guard let purchaseDoubleValue = purchasePriceValue.nsString?.doubleValue else {
            logger.error("Expecting purchase value to be a valid double")
            return 0
        }
        return purchaseDoubleValue
    }

    private var formValidity: Result<(), FormInvalidityErrors> {
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
        guard formIsValid else { return }
        guard let formPayload else {
            logger.error("After that the form is valid, we should have had payload")
            return
        }

        Task {
            await portfolio.storeTransaction(formPayload)
        }
    }

    private func handleOnAppear() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            focusedTextfield = .amount
        }
    }
}

private enum FormInvalidityErrors: Error {
    case noStockSelected
    case textField(message: String)
    case purchasePrice

    var errorDescription: String? {
        switch self {
        case .noStockSelected: NSLocalizedString("Please select a stock", comment: "")
        case .textField(let message): message
        case .purchasePrice: NSLocalizedString("Invalid purchase price", comment: "")
        }
    }
}

private enum EntryScreenFocusFields {
    case amount
}

#Preview("Transaction") {
    NavigationStack {
        KowalskiPortfolioTransactionScreen()
    }
    .preview()
}
