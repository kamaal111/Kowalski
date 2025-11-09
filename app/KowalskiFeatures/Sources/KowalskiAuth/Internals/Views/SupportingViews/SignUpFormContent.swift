//
//  SignUpFormContent.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/26/25.
//

import SwiftUI
import KamaalUI
import KowalskiDesignSystem

struct SignUpFormContent: View {
    @FocusState private var focusedTextfield: SignUpFormContentFocusFields?

    @State private var name = ""
    @State private var nameError: KowalskiTextFieldErrorResult?
    @State private var email = ""
    @State private var emailError: KowalskiTextFieldErrorResult?
    @State private var password = ""
    @State private var passwordError: KowalskiTextFieldErrorResult?
    @State private var verifyPassword = ""
    @State private var verifyPasswordError: KowalskiTextFieldErrorResult?

    let onSignUp: (_ payload: SignUpPayload) -> Void

    var body: some View {
        KJustStack {
            KowalskiTextField(
                text: $name,
                errorResult: $nameError,
                localizedTitle: "Name",
                bundle: .module,
                variant: .text,
                validations: [
                    .wordCount(
                        count: 2,
                        message: NSLocalizedString("Name should contain at least 2 words", comment: ""),
                    )
                ]
            )
            .focused($focusedTextfield, equals: .name)
            .onSubmit(handleSubmit)
            KowalskiTextField(
                text: $email,
                errorResult: $emailError,
                localizedTitle: "Email",
                bundle: .module,
                variant: .email,
                validations: [.email(message: NSLocalizedString("Not an valid email", comment: ""))]
            )
            .focused($focusedTextfield, equals: .email)
            .onSubmit(handleSubmit)
            KowalskiTextField(
                text: $password,
                errorResult: $passwordError,
                localizedTitle: "Password",
                bundle: .module,
                variant: .secure,
                validations: [
                    .minimumLength(
                        length: 8,
                        message: NSLocalizedString("Password must be atleast 8 characters", comment: "")
                    )
                ]
            )
            .focused($focusedTextfield, equals: .password)
            .onSubmit(handleSubmit)
            KowalskiTextField(
                text: $verifyPassword,
                errorResult: $verifyPasswordError,
                localizedTitle: "Confirm Password",
                bundle: .module,
                variant: .secure,
                validations: [
                    .isSameAs(
                        value: password,
                        message: NSLocalizedString("Password must be the same as the password above", comment: "")
                    )
                ]
            )
            .focused($focusedTextfield, equals: .verifyPassword)
            .onSubmit(handleSubmit)
            VStack {
                SubmitButton(disabled: !formIsValid, action: handleSubmit)
            }
            .padding(.vertical, .small)
        }
    }

    private var signUpPayload: SignUpPayload {
        SignUpPayload(name: name, email: email, password: password)
    }

    private var formIsValid: Bool {
        [nameError, emailError, passwordError, verifyPasswordError]
            .allSatisfy({ result in result?.isValid == true })
    }

    private func handleSubmit() {
        guard formIsValid else { return }

        onSignUp(signUpPayload)
    }
}

private enum SignUpFormContentFocusFields {
    case name
    case email
    case password
    case verifyPassword
}

#Preview {
    SignUpFormContent(onSignUp: { _ in })
}
