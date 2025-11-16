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

    public init(name: String, email: String, expiresAt: Date) {
        self.name = name
        self.email = email
        self.expiresAt = expiresAt
    }
}
