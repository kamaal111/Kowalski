//
//  UserSession.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation
import KowalskiUtils

package struct UserSession: Hashable, Codable, Expirable {
    package let name: String
    package let email: String
    package let expiresAt: Date
    package let preferredCurrency: String?

    package init(name: String, email: String, expiresAt: Date, preferredCurrency: String? = nil) {
        self.name = name
        self.email = email
        self.expiresAt = expiresAt
        self.preferredCurrency = preferredCurrency
    }
}
