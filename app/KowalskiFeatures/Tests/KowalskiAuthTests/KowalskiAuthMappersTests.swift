//
//  KowalskiAuthMappersTests.swift
//  KowalskiFeatures
//
//  Created by Copilot on 7/21/25.
//

import Foundation
@testable import KowalskiAuth
import KowalskiClient
import Testing

@Suite("Auth Mappers Tests")
struct KowalskiAuthMappersTests {
    private let mapper = KowalskiAuthMappers()

    @Test
    func `Map session response should preserve preferred currency when set`() {
        let response = KowalskiAuthSessionResponse(
            name: "Test User",
            email: "test@example.com",
            expiresAt: Date(timeIntervalSince1970: 1_766_246_840),
            preferredCurrency: "EUR",
        )

        let session = mapper.mapSessionResponse(response)

        #expect(session.preferredCurrency == "EUR")
        #expect(session.name == "Test User")
        #expect(session.email == "test@example.com")
    }

    @Test
    func `Map session response should preserve nil preferred currency`() {
        let response = KowalskiAuthSessionResponse(
            name: "Test User",
            email: "test@example.com",
            expiresAt: Date(timeIntervalSince1970: 1_766_246_840),
            preferredCurrency: nil,
        )

        let session = mapper.mapSessionResponse(response)

        #expect(session.preferredCurrency == nil)
    }
}
