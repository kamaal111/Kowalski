//
//  KowalskiAuthEnvironment.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/11/25.
//

import KamaalAuth
import SwiftUI

public extension View {
    /// Gates content on `KamaalAuth`'s shared sign-in flow, then exposes Kowalski's own `KowalskiAuth` — for
    /// `effectiveCurrency`, `session`, and `updatePreferredCurrency` — to everything inside.
    func kowalskiAuth(_ auth: KowalskiAuth) -> some View {
        environment(auth).kamaalAuth(auth.kamaalAuth)
    }
}
