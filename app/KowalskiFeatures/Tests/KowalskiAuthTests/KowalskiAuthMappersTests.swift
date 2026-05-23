//
//  KowalskiAuthMappersTests.swift
//  KowalskiFeatures
//
//  Created by Copilot on 7/21/25.
//

import Foundation
@testable import KowalskiAuth
@testable import KowalskiClient
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
            preferredCurrency: .EUR,
            hasPreferredCurrencyPreference: true,
        )

        let session = mapper.mapSessionResponse(response)

        #expect(session.preferredCurrency == .EUR)
        #expect(session.hasPreferredCurrencyPreference)
        #expect(session.name == "Test User")
        #expect(session.email == "test@example.com")
    }

    @Test
    func `Map session response should preserve default preferred currency`() {
        let response = KowalskiAuthSessionResponse(
            name: "Test User",
            email: "test@example.com",
            expiresAt: Date(timeIntervalSince1970: 1_766_246_840),
            preferredCurrency: .USD,
            hasPreferredCurrencyPreference: false,
        )

        let session = mapper.mapSessionResponse(response)

        #expect(session.preferredCurrency == .USD)
        #expect(!session.hasPreferredCurrencyPreference)
    }
}
