//
//  AuthClientConfigurationTests.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 19/12/2024.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("Auth Client Configuration Tests")
struct AuthClientConfigurationTests {
    @Test
    func `Session request should include Authorization header`() async throws {
        // Arrange
        let credentials = Credentials(
            authToken: "new_jwt_token",
            expiryDate: Date().addingTimeInterval(86400),
            sessionToken: "new_session_token",
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date(),
        )
        let credentialsGetter = MockCredentialsGetter(credentials: credentials)

        // Replicate makeClientForAuth logic from KowalskiClient.swift
        let middlewares: [any ClientMiddleware] = [
            RequestSigningMiddleware(keychainKey: "test_key", credentialsGetter: credentialsGetter),
            RefreshTokenMiddleware(credentialsGetter: credentialsGetter),
            RequiredHeadersMiddleware(),
            LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: 1024))
        ]

        let transport = MockTransport()
        let client = try Client(
            serverURL: #require(URL(string: "https://api.example.com")),
            transport: transport,
            middlewares: middlewares,
        )

        // Act
        _ = try? await client.getAppApiAuthSession()

        // Assert
        let capturedRequest = transport.capturedRequest
        #expect(capturedRequest != nil, "Request should be captured")

        let authHeader = capturedRequest?.headerFields[.authorization]
        #expect(authHeader == "Bearer new_jwt_token", "Session request MUST have Authorization header")
    }
}

// MARK: - Helpers

final class MockTransport: ClientTransport, @unchecked Sendable {
    var capturedRequest: HTTPRequest?

    func send(
        _ request: HTTPRequest,
        body _: HTTPBody?,
        baseURL _: URL,
        operationID _: String,
    ) async throws -> (HTTPResponse, HTTPBody?) {
        capturedRequest = request
        return (HTTPResponse(status: .ok), nil)
    }
}
