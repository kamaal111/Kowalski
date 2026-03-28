//
//  KowalskiTextField.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 10/5/25.
//

import KamaalUI
import SwiftUI
import SwiftValidator

public enum KowalskiTextFieldValidationRules {
    case minimumLength(length: Int, message: String)
    case isSameAs(value: String, message: String)
    case email(message: String)
    case wordCount(count: Int, message: String)
    case notEmpty(message: String)
    case numeric(locale: Locale, greaterThanOrEqualTo: Double, message: String)
}

public struct KowalskiTextFieldErrorResult: Equatable {
    public let isValid: Bool
    public let errorMessage: String?

    public init(isValid: Bool, errorMessage: String?) {
        self.isValid = isValid
        self.errorMessage = errorMessage
    }
}

public enum KowalskiTextFieldVariant {
    case text
    case decimals(locale: Locale)
    case numbers
    case secure
    case email

    #if canImport(UIKit)
        var keyboardType: UIKeyboardType {
            switch self {
            case .decimals: .decimalPad
            case .numbers: .numberPad
            case .text, .secure: .default
            case .email: .emailAddress
            }
        }
    #endif
}

extension KowalskiTextFieldVariant: Equatable {}

public struct KowalskiTextField: View {
    @State private var showPassword = false

    @FocusState private var isFocused: Bool

    @Binding private var text: String
    @Binding private var errorResult: KowalskiTextFieldErrorResult?

    public let title: String
    public let variant: KowalskiTextFieldVariant
    public let validations: [any StringValidatableRule]

    public init(
        text: Binding<String>,
        errorResult: Binding<KowalskiTextFieldErrorResult?>,
        title: String,
        variant: KowalskiTextFieldVariant = .text,
        validations: [KowalskiTextFieldValidationRules],
    ) {
        _text = text
        _errorResult = errorResult
        self.title = title
        self.variant = variant
        self.validations = validations.map { validation -> any StringValidatableRule in
            switch validation {
            case let .minimumLength(length, message):
                StringValidateMinimumLength(length: length, message: message)
            case let .isSameAs(value, message):
                StringIsTheSameValue(value: value, message: message)
            case let .email(message):
                StringIsEmail(message: message)
            case let .wordCount(count: count, message: message):
                StringValidateWordCount(wordCount: count, message: message)
            case let .notEmpty(message):
                StringIsNotEmpty(message: message)
            case let .numeric(locale, greaterThanOrEqualTo, message):
                StringIsNumeric(
                    locale: locale,
                    options: .init(comparison: .init(op: .greaterThanOrEqualTo, value: greaterThanOrEqualTo)),
                    message: message,
                )
            }
        }
    }

    public init(
        text: Binding<String>,
        errorResult: Binding<KowalskiTextFieldErrorResult?>,
        localizedTitle: LocalizedStringResource,
        bundle: Bundle? = nil,
        variant: KowalskiTextFieldVariant = .text,
        validations: [KowalskiTextFieldValidationRules],
    ) {
        let title =
            if let bundle {
                NSLocalizedString(localizedTitle.key, bundle: bundle, comment: "")
            } else {
                NSLocalizedString(localizedTitle.key, comment: "")
            }
        self.init(
            text: text,
            errorResult: errorResult,
            title: title,
            variant: variant,
            validations: validations,
        )
    }

    public init(text: Binding<String>, title: String, variant: KowalskiTextFieldVariant = .text) {
        self.init(
            text: text,
            errorResult: .constant(nil),
            title: title,
            variant: variant,
            validations: [],
        )
    }

    public init(
        text: Binding<String>,
        localizedTitle: LocalizedStringResource,
        bundle: Bundle,
        variant: KowalskiTextFieldVariant = .text,
    ) {
        self.init(
            text: text,
            title: NSLocalizedString(localizedTitle.key, bundle: bundle, comment: ""),
            variant: variant,
        )
    }

    public var body: some View {
        FloatingFieldWrapper(
            text: text, title: title, error: textFieldError,
            field: {
                if variant == .secure {
                    HStack {
                        KJustStack {
                            if showPassword {
                                TextField(placeholderText, text: $text)
                                    .focused($isFocused)
                            } else {
                                SecureField(placeholderText, text: $text)
                                    .focused($isFocused)
                            }
                        }
                        .ktakeWidthEagerly(alignment: .leading)
                        Image(systemName: !showPassword ? "eye" : "eye.slash")
                            .foregroundColor(showError ? Color.red : Color.accentColor)
                            .onTapGesture { handleShowPassword() }
                    }
                } else {
                    #if canImport(UIKit)
                        TextField(placeholderText, text: $text)
                            .focused($isFocused)
                            .keyboardType(variant.keyboardType)
                    #else
                        TextField(placeholderText, text: $text)
                            .focused($isFocused)
                    #endif
                }
            },
        )
        .onChange(of: text) { _, newValue in handleValueChange(value: newValue) }
    }

    private var placeholderText: String {
        #if canImport(UIKit)
            return ""
        #else
            return title
        #endif
    }

    private var validator: StringValidator {
        StringValidator(value: text, validators: validations)
    }

    private var textFieldError: (show: Bool, message: String?) {
        guard showError else { return (false, nil) }

        return (true, errorResult?.errorMessage)
    }

    private var showError: Bool {
        guard !validations.isEmpty else { return false }

        return !isFocused && !text.isEmpty && errorResult?.isValid != true
    }

    private func handleShowPassword() {
        showPassword.toggle()
    }

    private func handleValueChange(value: String) {
        let filteredValue = filterInput(value: value)
        if filteredValue != value {
            text = filteredValue
        }
        setErrorResult(value: filteredValue)
    }

    private func filterInput(value: String) -> String {
        switch variant {
        case .numbers:
            return value.filter(\.isNumber)
        case let .decimals(locale):
            let decimalSeparator = locale.decimalSeparator ?? "."
            var hasDecimalSeparator = false
            let filteredValue = value.filter { char in
                if char.isNumber {
                    return true
                }
                if String(char) == decimalSeparator, !hasDecimalSeparator {
                    hasDecimalSeparator = true
                    return true
                }
                return false
            }

            return String(filteredValue)
        case .text, .secure, .email:
            return value
        }
    }

    private func setErrorResult(value _: String) {
        let result = validator.result
        errorResult = KowalskiTextFieldErrorResult(isValid: result.valid, errorMessage: result.message)
    }
}

private struct FloatingFieldWrapper<Field: View>: View {
    @State private var textYOffset: CGFloat
    @State private var textScaleEffect: CGFloat

    private let text: String
    private let title: String
    private let error: (show: Bool, message: String?)
    private let field: () -> Field

    init(
        text: String,
        title: String,
        error: (show: Bool, message: String?),
        @ViewBuilder field: @escaping () -> Field,
    ) {
        self.text = text
        self.title = title
        self.error = error
        self.field = field
        textYOffset = Self.nextTextYOffsetValue(text.isEmpty)
        textScaleEffect = Self.nextTextScaleEffectValue(text.isEmpty)
    }

    var body: some View {
        VStack {
            ZStack(alignment: .leading) {
                Text(title)
                    .foregroundColor(textColor)
                    .offset(y: textYOffset)
                    .scaleEffect(textScaleEffect, anchor: .leading)
                    .padding(.horizontal, titleHorizontalPadding)
                field()
            }
            if error.show, let message = error.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(Color.red)
                    .ktakeWidthEagerly(alignment: .leading)
            }
        }
        .padding(.top, 12)
        .animation(.spring(response: 0.5), value: textYOffset)
        .onChange(of: text.isEmpty, handleOnTextIsEmptyChange)
    }

    private var textColor: Color {
        if text.isEmpty { .secondary } else { .accentColor }
    }

    private var titleHorizontalPadding: CGFloat {
        if text.isEmpty { 4 } else { 0 }
    }

    private func handleOnTextIsEmptyChange(_: Bool, _ newValue: Bool) {
        textYOffset = Self.nextTextYOffsetValue(newValue)
        textScaleEffect = Self.nextTextScaleEffectValue(newValue)
    }

    private static func nextTextYOffsetValue(_ textIsEmpty: Bool) -> CGFloat {
        if textIsEmpty { 0 } else { -25 }
    }

    private static func nextTextScaleEffectValue(_ textIsEmpty: Bool) -> CGFloat {
        if textIsEmpty { 1 } else { 0.75 }
    }
}

#Preview {
    VStack(spacing: 24) {
        KowalskiTextField(
            text: .constant("Yes"),
            errorResult: .constant(KowalskiTextFieldErrorResult(isValid: false, errorMessage: "Nooo")),
            title: "Task",
            validations: [],
        )
        KowalskiTextField(
            text: .constant(""),
            errorResult: .constant(KowalskiTextFieldErrorResult(isValid: false, errorMessage: "Nooo")),
            title: "Task",
            validations: [],
        )
    }
    .padding(.all, .medium)
}
