//
//  Preview.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/12/25.
//

import KowalskiAuth
import SwiftUI

extension View {
    func preview(withCredentials: Bool = true) -> some View {
        let auth = KowalskiAuth.preview(withCredentials: withCredentials)
        let portfolio = KowalskiPortfolio.preview()

        return kowalskiAuth(auth)
            .kowalskiPortfolio(portfolio)
    }
}
