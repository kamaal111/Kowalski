//
//  UserSession.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation
import KowalskiUtils

public struct UserSession: Hashable, Codable, Expirable {
    public let name: String
    public let expiresAt: Date
}
