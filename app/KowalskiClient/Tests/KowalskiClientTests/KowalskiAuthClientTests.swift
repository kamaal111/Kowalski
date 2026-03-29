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
                QueuedResponse(status: .badRequest, body: responseBody)
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
            )
        ])) {
            try await authClient.signIn(email: "not-an-email", password: "123456").get()
        }

        let request = try #require(transport.capturedRequests.first)
        #expect(request.path == "/app-api/auth/sign-in/email")
        #expect(request.method == .post)
    }
}
