//
//  KowalskiAuthTests.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/5/26.
//

import ForexKit
import Foundation
@testable import KowalskiAuth
@testable import KowalskiClient
import Testing

@MainActor
@Suite("Auth Feature Tests")
struct KowalskiAuthTests {
    @Test
    func `Update preferred currency should refresh the effective currency after a successful save`() async throws {
        let authClient = MockAuthClient(
            updatePreferencesResult: .success(makeSessionResponse(preferredCurrency: "EUR")),
        )
        let auth = KowalskiAuth.testing(
            client: .testing(auth: authClient),
            session: makeSession(preferredCurrency: "USD"),
        )

        try await auth.updatePreferredCurrency(.EUR).get()

        #expect(auth.effectiveCurrency == .EUR)
        #expect(await authClient.updatePreferencesCallCount == 1)
        #expect(await authClient.lastPreferredCurrency == "EUR")
    }
}

private actor MockAuthClient: KowalskiAuthClient {
    private(set) var updatePreferencesCallCount = 0
    private(set) var lastPreferredCurrency: String?

    private let updatePreferencesResult: Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors>

    init(
        updatePreferencesResult: Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors>,
    ) {
        self.updatePreferencesResult = updatePreferencesResult
    }

    func signUp(name _: String, email _: String, password _: String) async -> Result<Void, KowalskiAuthSignUpErrors> {
        .success(())
    }

    func signIn(email _: String, password _: String) async -> Result<Void, KowalskiAuthSignInErrors> {
        .success(())
    }

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        .success(makeSessionResponse(preferredCurrency: "USD"))
    }

    func refreshToken() async -> Result<Void, KowalskiAuthRefreshErrors> {
        .success(())
    }

    func updatePreferences(
        preferredCurrency: String,
    ) async -> Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors> {
        updatePreferencesCallCount += 1
        lastPreferredCurrency = preferredCurrency

        return updatePreferencesResult
    }
}

private func makeSession(preferredCurrency: String?) -> UserSession {
    UserSession(
        name: "Test User",
        email: "test@example.com",
        expiresAt: Date(timeIntervalSince1970: 1_767_139_200),
        preferredCurrency: preferredCurrency,
    )
}

private func makeSessionResponse(preferredCurrency: String?) -> KowalskiAuthSessionResponse {
    KowalskiAuthSessionResponse(
        name: "Test User",
        email: "test@example.com",
        expiresAt: Date(timeIntervalSince1970: 1_767_139_200),
        preferredCurrency: preferredCurrency,
    )
}
