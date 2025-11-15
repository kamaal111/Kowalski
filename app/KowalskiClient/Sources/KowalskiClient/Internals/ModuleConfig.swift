//
//  ModuleConfig.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation

private let ONE_KILO_BYTE = 1000

enum ModuleConfig {
    static let identifier = "\(Bundle.main.bundleIdentifier!).KowalskiClient"
    static let maxLogSize = ONE_KILO_BYTE * 64
    static let credentialsKeychainKey = "\(identifier).credentials"
}
