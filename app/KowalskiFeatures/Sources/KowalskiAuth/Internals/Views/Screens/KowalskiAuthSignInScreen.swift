//
//  KowalskiAuthSignInScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import SwiftUI
import KamaalUI
import KowalskiDesignSystem

struct KowalskiAuthSignInScreen: View {
    @Environment(KowalskiAuth.self) private var auth

    @State private var signUpScreenIsShown = false
    @State private var toast: Toast?

    var body: some View {
        KFormBox(localizedTitle: "Sign In", bundle: .module, minSize: ModuleConfig.screenMinSize, content: {
            SignInFormContent(onSignIn: handleSignIn, onSignUpPress: handleSignUpPress)
        })
        .navigationDestination(isPresented: $signUpScreenIsShown) {
            KowalskiAuthSignUpScreen()
                .toastView(toast: $toast)
        }
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button(action: handleSignUpPress) {
                    Text("Sign Up")
                        .bold()
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
        .toastView(toast: $toast)
    }

    private func handleSignUpPress() {
        signUpScreenIsShown = true
    }

    private func handleSignIn(_ payload: SignInPayload) {
        Task {
            let result = await auth.signIn(email: payload.email, password: payload.password)
            switch result {
            case let .failure(failure):
                toast = .error(message: failure.errorDescription ?? failure.localizedDescription)
            case .success: break
            }
        }
    }
}

#Preview {
    KowalskiAuthSignInScreen()
        .preview()
}
