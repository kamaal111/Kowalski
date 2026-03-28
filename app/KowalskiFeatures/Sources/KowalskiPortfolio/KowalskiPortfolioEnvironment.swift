//
//  KowalskiPortfolioEnvironment.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/9/25.
//

import SwiftUI

public extension View {
    func kowalskiPortfolio(_ portfolio: KowalskiPortfolio) -> some View {
        environment(portfolio)
    }
}
