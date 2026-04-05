//
//  KowalskiAuthSessionResponse.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

import Foundation

public struct KowalskiAuthSessionResponse: Codable, Sendable {
    public let name: String
    public let email: String
    public let expiresAt: Date
    public let preferredCurrency: String?

    public init(name: String, email: String, expiresAt: Date, preferredCurrency: String?) {
        self.name = name
        self.email = email
        self.expiresAt = expiresAt
        self.preferredCurrency = preferredCurrency
    }
}
