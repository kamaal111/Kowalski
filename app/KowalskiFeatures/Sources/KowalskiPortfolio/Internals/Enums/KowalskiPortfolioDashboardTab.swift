//
//  KowalskiPortfolioDashboardTab.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 7/12/26.
//

import SwiftUI

enum KowalskiPortfolioDashboardTab: String, CaseIterable, Codable, Sendable {
    case progress
    case holdings

    var dashboardLabel: LocalizedStringKey {
        switch self {
        case .progress: "Progress"
        case .holdings: "Holdings"
        }
    }
}
