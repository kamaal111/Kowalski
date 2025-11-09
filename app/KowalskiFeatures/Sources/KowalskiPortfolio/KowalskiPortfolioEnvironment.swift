//
//  KowalskiPortfolioEnvironment.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/9/25.
//

import SwiftUI

extension View {
    public func kowalskiPortfolio(_ portfolio: KowalskiPortfolio) -> some View {
        self
            .environment(portfolio)
    }
}
