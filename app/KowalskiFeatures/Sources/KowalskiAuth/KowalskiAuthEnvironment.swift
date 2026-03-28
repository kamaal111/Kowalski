//
//  KowalskiAuthEnvironment.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/11/25.
//

import KamaalUI
import SwiftUI

public extension View {
    func kowalskiAuth(_ auth: KowalskiAuth) -> some View {
        modifier(KowalskiAuthEnvironment(auth: auth))
    }
}

struct KowalskiAuthEnvironment: ViewModifier {
    @State private var auth: KowalskiAuth

    init(auth: KowalskiAuth) {
        self.auth = auth
    }

    func body(content: Content) -> some View {
        KJustStack {
            if auth.initiallyValidatingToken {
                ProgressView()
            } else {
                if !auth.isLoggedIn {
                    NavigationStack {
                        KowalskiAuthSignInScreen()
                    }
                } else {
                    content
                }
            }
        }
        .environment(auth)
    }
}
