//
//  UserSession.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation
import KowalskiModels
import KowalskiUtils

package struct UserSession: Hashable, Codable, Expirable {
    package let name: String
    package let email: String
    package let expiresAt: Date
    package let preferredCurrency: KowalskiCurrency
    package let hasPreferredCurrencyPreference: Bool

    package init(
        name: String,
        email: String,
        expiresAt: Date,
        preferredCurrency: KowalskiCurrency,
        hasPreferredCurrencyPreference: Bool,
    ) {
        self.name = name
        self.email = email
        self.expiresAt = expiresAt
        self.preferredCurrency = preferredCurrency
        self.hasPreferredCurrencyPreference = hasPreferredCurrencyPreference
    }

    private enum CodingKeys: String, CodingKey {
        case name
        case email
        case expiresAt
        case preferredCurrency
        case hasPreferredCurrencyPreference
    }
}
