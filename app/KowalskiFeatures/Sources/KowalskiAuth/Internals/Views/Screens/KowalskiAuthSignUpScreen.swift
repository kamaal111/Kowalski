//
//  KowalskiAuthSignUpScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/12/25.
//

import SwiftUI
import KamaalUI
import KowalskiDesignSystem

struct KowalskiAuthSignUpScreen: View {
    @Environment(KowalskiAuth.self) private var auth

    @Binding var toast: Toast?

    @State private var signingUp = false

    var body: some View {
        KFormBox(localizedTitle: "Sign Up", bundle: .module, minSize: ModuleConfig.screenMinSize, content: {
            SignUpFormContent(onSignUp: handleSignUp)
                .disabled(signingUp)
        })
    }

    private func handleSignUp(_ payload: SignUpPayload) {
        signingUp = true
        Task {
            let result = await auth.signUp(payload)
            switch result {
            case let .failure(failure):
                toast = .error(message: failure.errorDescription ?? failure.localizedDescription)
            case .success: break
            }
            signingUp = false
        }
    }
}

#Preview {
    KowalskiAuthSignUpScreen(toast: .constant(nil))
        .preview(withCredentials: false)
}
