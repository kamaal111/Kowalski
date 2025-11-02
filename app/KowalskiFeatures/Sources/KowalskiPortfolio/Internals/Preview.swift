//
//  Preview.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/12/25.
//

import SwiftUI
import KowalskiAuth

extension View {
    func preview(withCredentials: Bool) -> some View {
        let auth = KowalskiAuth.preview(withCredentials: withCredentials)

        return self
            .kowalskiAuth(auth)
    }
}
