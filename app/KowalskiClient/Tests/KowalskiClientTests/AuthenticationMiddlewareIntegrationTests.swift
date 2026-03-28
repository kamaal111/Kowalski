//
//  AuthenticationMiddlewareIntegrationTests.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 19/12/2024.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

@Suite("AuthenticationMiddleware Integration Tests")
struct AuthenticationMiddlewareIntegrationTests {
    @Test
    func `Should add both Authorization header and session token cookie to requests`() async throws {
        // Arrange
        let mockCredentials = Credentials(
            authToken: "test_jwt_token_12345",
            expiryDate: Date().addingTimeInterval(86400 * 7), // 7 days in future - won't trigger refresh
            sessionToken: "test_session_token_67890",
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date(),
        )

        let credentialsGetter = MockCredentialsGetter(credentials: mockCredentials)
        let authClient = MockAuthClient()

        let middleware = AuthenticationMiddleware(
            keychainKey: "test_key",
            credentialsGetter: credentialsGetter,
            authClient: authClient,
        )

        let request = HTTPRequest(method: .get, scheme: "https", authority: "api.example.com", path: "/test")
        let body: HTTPBody? = nil
        let baseURL = try #require(URL(string: "https://api.example.com"))

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { req, _, _ in
            capturedRequest = req
            return (HTTPResponse(status: .ok), nil)
        }

        // Act
        _ = try await middleware.intercept(
            request,
            body: body,
            baseURL: baseURL,
            operationID: "test",
            next: next,
        )

        // Assert
        #expect(capturedRequest != nil, "Request should be captured")

        let authHeader = capturedRequest?.headerFields[.authorization]
        #expect(authHeader == "Bearer test_jwt_token_12345", "Authorization header should contain JWT")

        let cookieHeader = capturedRequest?.headerFields[.cookie]
        #expect(cookieHeader != nil, "Cookie header should exist")
        #expect(
            cookieHeader?.contains("better-auth.session_token=test_session_token_67890") == true,
            "Cookie should contain session token",
        )
    }

    @Test
    func `Should append session cookie to existing cookies`() async throws {
        // Arrange
        let mockCredentials = Credentials(
            authToken: "test_jwt",
            expiryDate: Date().addingTimeInterval(86400 * 7), // 7 days in future - won't trigger refresh
            sessionToken: "test_session",
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date(),
        )

        let credentialsGetter = MockCredentialsGetter(credentials: mockCredentials)
        let authClient = MockAuthClient()

        let middleware = AuthenticationMiddleware(
            keychainKey: "test_key",
            credentialsGetter: credentialsGetter,
            authClient: authClient,
        )

        var request = HTTPRequest(method: .get, scheme: "https", authority: "api.example.com", path: "/test")
        request.headerFields[.cookie] = "existing_cookie=value"

        let body: HTTPBody? = nil
        let baseURL = try #require(URL(string: "https://api.example.com"))

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { req, _, _ in
            capturedRequest = req
            return (HTTPResponse(status: .ok), nil)
        }

        // Act
        _ = try await middleware.intercept(
            request,
            body: body,
            baseURL: baseURL,
            operationID: "test",
            next: next,
        )

        // Assert
        let cookieHeader = capturedRequest?.headerFields[.cookie]
        #expect(cookieHeader != nil, "Cookie header should exist")
        #expect(
            cookieHeader?.contains("existing_cookie=value") == true,
            "Existing cookie should be preserved",
        )
        #expect(
            cookieHeader?.contains("better-auth.session_token=test_session") == true,
            "Session token should be appended",
        )
        #expect(
            cookieHeader?.contains("; ") == true,
            "Cookies should be separated by semicolon and space",
        )
    }

    @Test
    func `Should proceed without auth when credentials are missing`() async throws {
        // Arrange
        let credentialsGetter = MockCredentialsGetter(credentials: nil)
        let authClient = MockAuthClient()

        let middleware = AuthenticationMiddleware(
            keychainKey: "test_key",
            credentialsGetter: credentialsGetter,
            authClient: authClient,
        )

        let request = HTTPRequest(method: .get, scheme: "https", authority: "api.example.com", path: "/test")
        let body: HTTPBody? = nil
        let baseURL = try #require(URL(string: "https://api.example.com"))

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { req, _, _ in
            capturedRequest = req
            return (HTTPResponse(status: .ok), nil)
        }

        // Act
        _ = try await middleware.intercept(
            request,
            body: body,
            baseURL: baseURL,
            operationID: "test",
            next: next,
        )

        // Assert
        #expect(capturedRequest != nil, "Request should be captured")
        #expect(
            capturedRequest?.headerFields[.authorization] == nil,
            "Should not add Authorization header without credentials",
        )
        #expect(
            capturedRequest?.headerFields[.cookie] == nil,
            "Should not add Cookie header without credentials",
        )
    }
}

// MARK: - Mock Helpers

private struct MockAuthClient: KowalskiAuthClient {
    func signUp(name _: String, email _: String, password _: String) async -> Result<Void, KowalskiAuthSignUpErrors> {
        .failure(.unknown(statusCode: 500, payload: nil, context: nil))
    }

    func signIn(email _: String, password _: String) async -> Result<Void, KowalskiAuthSignInErrors> {
        .failure(.unknown(statusCode: 500, payload: nil, context: nil))
    }

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        .failure(.unknown(statusCode: 500, payload: nil, context: nil))
    }

    func refreshToken() async -> Result<Void, KowalskiAuthRefreshErrors> {
        .failure(.unknown(statusCode: 500, payload: nil, context: nil))
    }
}
