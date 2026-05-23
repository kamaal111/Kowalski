//
//  KowalskiAuthTests.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/5/26.
//

import Foundation
@testable import KowalskiAuth
@testable import KowalskiClient
import KowalskiModels
import Testing

@MainActor
@Suite("Auth Feature Tests")
struct KowalskiAuthTests {
    @Test
    func `Update preferred currency should refresh the effective currency after a successful save`() async throws {
        let authClient = MockAuthClient(
            updatePreferencesResult: .success(makeSessionResponse(preferredCurrency: .EUR)),
        )
        let auth = KowalskiAuth.testing(
            client: .testing(auth: authClient),
            session: makeSession(preferredCurrency: .USD),
        )

        try await auth.updatePreferredCurrency(.EUR).get()

        #expect(auth.effectiveCurrency == .EUR)
        #expect(await authClient.updatePreferencesCallCount == 1)
        #expect(await authClient.lastPreferredCurrency == .EUR)
    }

    @Test
    func `Load session should seed locale currency when no preference is saved`() async throws {
        let previousLocaleCurrencyProvider = KowalskiAuth.localeCurrencyProvider
        KowalskiAuth.localeCurrencyProvider = { .EUR }
        defer { KowalskiAuth.localeCurrencyProvider = previousLocaleCurrencyProvider }

        let authClient = MockAuthClient(
            sessionResult: .success(
                makeSessionResponse(preferredCurrency: .USD, hasPreferredCurrencyPreference: false),
            ),
            updatePreferencesResult: .success(makeSessionResponse(preferredCurrency: .EUR)),
        )
        let auth = KowalskiAuth.testing(client: .testing(auth: authClient))

        try await auth.loadSession().get()

        #expect(auth.effectiveCurrency == .EUR)
        #expect(await authClient.updatePreferencesCallCount == 1)
        #expect(await authClient.lastPreferredCurrency == .EUR)
    }
}

private actor MockAuthClient: KowalskiAuthClient {
    private(set) var updatePreferencesCallCount = 0
    private(set) var lastPreferredCurrency: KowalskiCurrency?

    private let sessionResult: Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors>
    private let updatePreferencesResult: Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors>

    init(
        sessionResult: Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> = .success(
            makeSessionResponse(preferredCurrency: .USD),
        ),
        updatePreferencesResult: Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors>,
    ) {
        self.sessionResult = sessionResult
        self.updatePreferencesResult = updatePreferencesResult
    }

    func signUp(name _: String, email _: String, password _: String) async -> Result<Void, KowalskiAuthSignUpErrors> {
        .success(())
    }

    func signIn(email _: String, password _: String) async -> Result<Void, KowalskiAuthSignInErrors> {
        .success(())
    }

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        sessionResult
    }

    func refreshToken() async -> Result<Void, KowalskiAuthRefreshErrors> {
        .success(())
    }

    func updatePreferences(
        preferredCurrency: KowalskiCurrency,
    ) async -> Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors> {
        updatePreferencesCallCount += 1
        lastPreferredCurrency = preferredCurrency

        return updatePreferencesResult
    }
}

private func makeSession(preferredCurrency: KowalskiCurrency) -> UserSession {
    UserSession(
        name: "Test User",
        email: "test@example.com",
        expiresAt: Date(timeIntervalSince1970: 1_767_139_200),
        preferredCurrency: preferredCurrency,
        hasPreferredCurrencyPreference: true,
    )
}

private func makeSessionResponse(
    preferredCurrency: KowalskiCurrency,
    hasPreferredCurrencyPreference: Bool = true,
) -> KowalskiAuthSessionResponse {
    KowalskiAuthSessionResponse(
        name: "Test User",
        email: "test@example.com",
        expiresAt: Date(timeIntervalSince1970: 1_767_139_200),
        preferredCurrency: preferredCurrency,
        hasPreferredCurrencyPreference: hasPreferredCurrencyPreference,
    )
}
