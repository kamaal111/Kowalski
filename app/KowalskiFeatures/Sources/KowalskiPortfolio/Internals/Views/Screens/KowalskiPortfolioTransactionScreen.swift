//
//  KowalskiPortfolioTransactionScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/2/25.
//

import ForexKit
import KamaalExtensions
import KamaalLogger
import KamaalUI
import KowalskiDesignSystem
import SwiftUI

private let logger = KamaalLogger(from: KowalskiPortfolioTransactionScreen.self, failOnError: false)

struct KowalskiPortfolioTransactionScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio
    @Environment(\.dismiss) private var dismiss

    @FocusState private var focusedTextfield: EntryScreenFocusFields?

    @State private var selectedStock: Stock?
    @State private var amount = ""
    @State private var amountError: KowalskiTextFieldErrorResult?
    @State private var purchasePriceCurrency: Currencies = .USD
    @State private var purchasePriceValue = "0"
    @State private var transactionType: TransactionType = .purchase
    @State private var transactionDate: Date = .now
    @State private var toast: Toast?

    let onTransactionAdd: (_ formPayload: TransactionPayload) -> Void

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
                    },
                )
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
                            EmptyView()
                        },
                    )
                    .labelsHidden()
                    .pickerStyle(.menu)
                    DatePicker("", selection: $transactionDate, displayedComponents: .date)
                        .labelsHidden()
                }
                .padding(.vertical, .small)
                .ktakeWidthEagerly(alignment: .leading)
                Button(action: handleSubmit) {
                    Text("Add Transaction")
                        .ktakeWidthEagerly()
                }
                .disabled(!submissionIsEnabled)
            }
        }
        .navigationTitle("Add Transaction")
        .onAppear(perform: handleOnAppear)
        .toastView(toast: $toast)
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
            logger.error("Expecting purchase value to be a valid double")
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
            logger.error("After that the form is valid, we should have had payload")
            return
        }

        Task {
            let result = await portfolio.storeTransaction(formPayload)
            switch result {
            case let .failure(failure):
                logger.error(label: "Failed to add transaction", error: failure)
                toast = .error(message: failure.localizedDescription)
            case .success:
                dismiss()
                onTransactionAdd(formPayload)
            }
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
        case let .textField(message): message
        case .purchasePrice: NSLocalizedString("Invalid purchase price", comment: "")
        }
    }
}

private enum EntryScreenFocusFields {
    case amount
}

#Preview("Transaction") {
    NavigationStack {
        KowalskiPortfolioTransactionScreen(onTransactionAdd: { _ in })
    }
    .preview()
}
