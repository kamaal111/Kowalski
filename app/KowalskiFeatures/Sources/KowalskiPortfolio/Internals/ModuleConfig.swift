//
//  ModuleConfig.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation

enum ModuleConfig {
    static let identifier = "\(Bundle.main.bundleIdentifier!).KowalskiPortfolio"
    static let screenMinSize: CGSize = .init(width: 400, height: 300)
    static let defaultLocale: Locale = .current
}
