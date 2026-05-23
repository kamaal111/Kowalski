//
//  CachedUserSessionTests.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/5/26.
//

import Foundation
@testable import KowalskiAuth
import Testing

@Suite("Cached User Session Tests")
struct CachedUserSessionTests {
    @Test
    func `Cached user session should persist preferred currency inside the nested session`() throws {
        let session = CachedUserSession(
            session: UserSession(
                name: "Test User",
                email: "test@example.com",
                expiresAt: Date(timeIntervalSince1970: 1_767_139_200),
                preferredCurrency: .EUR,
                hasPreferredCurrencyPreference: true,
            ),
            cachedAt: Date(timeIntervalSince1970: 1_744_764_800),
        )

        let data = try JSONEncoder().encode(session)
        let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let encodedSession = try #require(object["session"] as? [String: Any])

        #expect(encodedSession["preferredCurrency"] as? String == "EUR")
        #expect(encodedSession["hasPreferredCurrencyPreference"] as? Bool == true)
    }

    @Test
    func `Cached user session should decode preferred currency from cached payloads`() throws {
        let data = Data(
            """
            {
              "session": {
                "name": "Test User",
                "email": "test@example.com",
                "expiresAt": 768960000,
                "preferredCurrency": "USD",
                "hasPreferredCurrencyPreference": false
              },
              "cachedAt": 765504000
            }
            """.utf8,
        )

        let decoded = try JSONDecoder().decode(CachedUserSession.self, from: data)

        #expect(decoded.session.name == "Test User")
        #expect(decoded.session.email == "test@example.com")
        #expect(decoded.session.preferredCurrency == .USD)
        #expect(!decoded.session.hasPreferredCurrencyPreference)
    }
}
