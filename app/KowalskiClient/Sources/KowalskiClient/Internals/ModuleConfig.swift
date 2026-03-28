//
//  ModuleConfig.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation

private let oneKiloByte = 1000

enum ModuleConfig {
    static let identifier = "\(Bundle.main.bundleIdentifier!).KowalskiClient"
    static let maxLogSize = oneKiloByte
    static let credentialsKeychainKey = "\(identifier).credentials"
}
