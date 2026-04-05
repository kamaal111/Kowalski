//
//  KowalskiAuthClientTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 3/29/26.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("Auth Client Tests")
struct KowalskiAuthClientTests {
    @Test
    func `Sign in should expose validation issues from a bad request response`() async throws {
        let responseBody = Data(
            """
            {
              "message": "Invalid payload",
              "code": "INVALID_PAYLOAD",
              "context": {
                "validations": [
                  {
                    "code": "invalid_string",
                    "path": ["email"],
                    "message": "Invalid email address"
                  }
                ]
              }
            }
            """.utf8,
        )
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .badRequest, body: responseBody),
            ],
        )
        let client = try Client(
            serverURL: #require(URL(string: "https://api.example.com")),
            transport: transport,
        )
        let keychainKey = "kowalski-auth-client-tests-\(UUID().uuidString)"

        let authClient = KowalskiAuthClientFactory.default(
            client: client,
            credentialsKeychainKey: keychainKey,
            credentialsGetter: MockCredentialsGetter(credentials: nil),
        )

        try await #require(throws: KowalskiAuthSignInErrors.badRequest(validations: [
            KowalskiClientValidationIssue(
                code: "invalid_string",
                path: ["email"],
                message: "Invalid email address",
            ),
        ])) {
            try await authClient.signIn(email: "not-an-email", password: "123456").get()
        }

        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/auth/sign-in/email")
        #expect(request.method == .post)
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
                "preferred_currency": "EUR"
              }
            }
            """.utf8,
        )
        let transport = MockClientTransport(
            queuedResponses: [
                QueuedResponse(status: .ok, body: responseBody),
            ],
        )
        let client = try makeGeneratedClient(transport: transport)
        let keychainKey = "kowalski-auth-client-tests-\(UUID().uuidString)"
        let authClient = KowalskiAuthClientFactory.default(
            client: client,
            credentialsKeychainKey: keychainKey,
            credentialsGetter: MockCredentialsGetter(credentials: nil),
        )

        let response = try await authClient.updatePreferences(preferredCurrency: "USD").get()

        #expect(response.preferredCurrency == "EUR")
        #expect(response.name == "Test User")
        #expect(response.email == "test@example.com")
        #expect(response.expiresAt == Date(timeIntervalSince1970: 1_767_139_200))

        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/auth/preferences")
        #expect(request.method == .patch)
    }
}

private func makeGeneratedClient(transport: some ClientTransport) throws -> Client {
    try Client(
        serverURL: #require(URL(string: "https://api.example.com")),
        transport: transport,
    )
}
