//
//  SignInFormContent.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/12/25.
//

import SwiftUI
import KamaalUI
import KowalskiDesignSystem

struct SignInFormContent: View {
    @FocusState private var focusedTextfield: SignInFormContentFocusFields?

    @State private var email = ""
    @State private var emailError: KowalskiTextFieldErrorResult?
    @State private var password = ""
    @State private var passwordError: KowalskiTextFieldErrorResult?

    let onSignIn: (_ payload: SignInPayload) -> Void
    let onSignUpPress: () -> Void

    var body: some View {
        KJustStack {
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
            VStack {
                Button(action: handleSubmit) {
                    Text("Continue")
                        .bold()
                        .foregroundStyle(formIsValid ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.plain)
                .disabled(!formIsValid)
            }
            .padding(.vertical, .small)
            Button(action: onSignUpPress) {
                HStack {
                    Text("Don't have an account yet?")
                    Text("Sign Up")
                        .foregroundStyle(Color.accentColor)
                        .bold()
                        .underline()
                }
                .padding(.bottom, .small)
            }
            .buttonStyle(.plain)
        }
    }

    private var loginPayload: SignInPayload {
        SignInPayload(email: email, password: password)
    }

    private var formIsValid: Bool {
        [emailError, passwordError]
            .allSatisfy({ result in result?.valid == true })
    }

    private func handleSubmit() {
        guard formIsValid else { return }

        onSignIn(loginPayload)
    }
}

private enum SignInFormContentFocusFields {
    case email
    case password
}

#Preview {
    SignInFormContent(onSignIn: { _ in }, onSignUpPress: { })
}
