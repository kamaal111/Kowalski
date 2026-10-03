//
//  KowalskiAuthClientTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

import Foundation
import HTTPTypes
import KamaalAuth
import KamaalAuthTestSupport
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("Auth Client Tests")
struct KowalskiAuthClientTests {
    @Test
    func `Sign out posts to the auth route and deletes credentials`() async throws {
        let transport = MockClientTransport(queuedResponses: [.init(status: .ok, body: Data("{}".utf8))])
        let client = try Client(serverURL: #require(URL(string: "https://api.example.com")), transport: transport)
        let store = InMemoryCredentialsStore()
        let key = "sign-out-success"
        try store.store(MockAuthRequestHooks.credentials().credentials(), forKey: key)
        let auth = KamaalAuthClientImpl(
            hooks: KowalskiAuthRequestHooks(client: client), credentialsKey: key, credentialsStore: store,
        )

        try await auth.signOut().get()

        #expect(!auth.hasValidCredentials)
        #expect(try store.get(forKey: key) == nil)
        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/auth/sign-out")
        #expect(request.method == .post)
    }

    @Test
    func `Sign out deletes credentials when the server fails`() async throws {
        let transport = MockClientTransport(queuedResponses: [.init(status: .serviceUnavailable)])
        let client = try Client(serverURL: #require(URL(string: "https://api.example.com")), transport: transport)
        let store = InMemoryCredentialsStore()
        let key = "sign-out-failure"
        try store.store(MockAuthRequestHooks.credentials().credentials(), forKey: key)
        let auth = KamaalAuthClientImpl(
            hooks: KowalskiAuthRequestHooks(client: client), credentialsKey: key, credentialsStore: store,
        )

        await #expect(throws: SignOutErrors.self) { try await auth.signOut().get() }

        #expect(!auth.hasValidCredentials)
        #expect(try store.get(forKey: key) == nil)
        #expect(transport.capturedRequests.count == 1)
    }

    @Test
    func `Update preferences should return mapped client session response`() async throws {
        let responseBody = Data(
            """
            {
              "session": {
                "expires_at": "2025-12-31T00:00:00Z",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-04-01T00:00:00Z"
              },
              "user": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Test User",
                "email": "test@example.com",
                "email_verified": true,
                "created_at": "2025-01-01T00:00:00Z",
                "preferred_currency": "EUR",
                "has_preferred_currency_preference": true
              }
            }
            """.utf8,
        )
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .ok, body: responseBody),
            ],
        )
        let client = try Client(serverURL: #require(URL(string: "https://api.example.com")), transport: transport)
        let kowalskiClient = KowalskiClient.testing(client: client)

        let response = try await kowalskiClient.updatePreferences(preferredCurrency: .USD).get()

        #expect(response.preferredCurrency == .EUR)
        #expect(response.hasPreferredCurrencyPreference)
        #expect(response.name == "Test User")
        #expect(response.email == "test@example.com")
        #expect(response.expiresAt == Date(timeIntervalSince1970: 1_767_139_200))

        let request = try #require(transport.capturedRequests.first)
        let body = try #require(transport.capturedBodies.first)
        let decodedBody = try JSONDecoder().decode(UpdatePreferencesRequestBody.self, from: #require(body))

        #expect(request.path == "/app-api/auth/preferences")
        #expect(request.method == .patch)
        #expect(decodedBody.preferredCurrency == "USD")
    }
}

private struct UpdatePreferencesRequestBody: Decodable {
    let preferredCurrency: String

    enum CodingKeys: String, CodingKey {
        case preferredCurrency = "preferred_currency"
    }
}
