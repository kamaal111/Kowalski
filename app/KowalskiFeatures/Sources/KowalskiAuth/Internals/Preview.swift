//
//  Preview.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/12/25.
//

import SwiftUI

extension View {
    func preview() -> some View {
        let auth = KowalskiAuth()

        return self
            .kowalskiAuth(auth)
    }
}
