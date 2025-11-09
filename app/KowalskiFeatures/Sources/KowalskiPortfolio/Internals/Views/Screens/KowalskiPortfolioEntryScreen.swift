//
//  KowalskiPortfolioEntryScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/2/25.
//

import SwiftUI
import ForexKit
import KamaalUI
import KamaalExtensions
import KowalskiDesignSystem

struct KowalskiPortfolioEntryScreen: View {
    @FocusState private var focusedTextfield: EntryScreenFocusFields?

    @State private var symbolOrIsin = ""
    @State private var symbolOrIsinError: KowalskiTextFieldErrorResult?
    @State private var amount = ""
    @State private var amountError: KowalskiTextFieldErrorResult?
    @State private var purchasePriceCurrency: Currencies = .USD
    @State private var purchasePriceValue = "0"
    @State private var transactionType: TransactionType = .purchase
    @State private var transactionDate: Date = .now

    var body: some View {
        KFormBox(localizedTitle: "Add Entry", bundle: .module, minSize: ModuleConfig.screenMinSize) {
            VStack {
                KowalskiTextField(
                    text: $symbolOrIsin,
                    errorResult: $symbolOrIsinError,
                    localizedTitle: "Symbol or ISIN",
                    bundle: .module,
                    variant: .text,
                    validations: [
                        .notEmpty(message: NSLocalizedString("Symbol can not be empty", bundle: .module, comment: "")),
                    ]
                )
                .focused($focusedTextfield, equals: .symbolOrIsin)
                .onSubmit(handleSubmit)
                MoneyField(
                    currency: $purchasePriceCurrency,
                    value: $purchasePriceValue,
                    title: NSLocalizedString("Purchase price", bundle: .module, comment: ""),
                    currencies: Currencies.allCases,
                    fixButtonTitle: NSLocalizedString("Fix", bundle: .module, comment: ""),
                    fixMessage: "Invalid value"
                )
                KowalskiTextField(
                    text: $amount,
                    errorResult: $amountError,
                    localizedTitle: "Amount",
                    bundle: .module,
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
        .navigationTitle("Entry")
        .onAppear(perform: handleOnAppear)
    }

    private var textFieldErrors: [KowalskiTextFieldErrorResult] {
        [symbolOrIsinError, amountError]
            .compactMap { $0 }
    }

    private var purchasePriceDoubleValue: Double {
        guard let purchaseDoubleValue = purchasePriceValue.nsString?.doubleValue else {
            assertionFailure("Expecting purchase value to be a valid double")
            return 0
        }
        return purchaseDoubleValue
    }

    private var formValidity: Result<(), FormInvalidityErrors> {
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
    }

    private func handleOnAppear() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            focusedTextfield = .symbolOrIsin
        }
    }
}

private enum FormInvalidityErrors: Error {
    case textField(message: String)
    case purchasePrice

    var errorDescription: String? {
        switch self {
        case let .textField(message): message
        case .purchasePrice: NSLocalizedString("Invalid purchase price", bundle: .module, comment: "")
        }
    }
}

private enum EntryScreenFocusFields {
    case symbolOrIsin
    case amount
}

private enum TransactionType: CaseIterable {
    case purchase
    case sell

    var label: String {
        switch self {
        case .purchase: NSLocalizedString("Purchase", bundle: .module, comment: "")
        case .sell: NSLocalizedString("Sell", bundle: .module, comment: "")
        }
    }
}

#Preview("Entry") {
    NavigationStack {
        KowalskiPortfolioEntryScreen()
    }
    .preview()
}
