//
//  RefreshTokenMiddlewareTests.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 14/12/25.
//

import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing

@testable import KowalskiClient

@Suite("RefreshTokenMiddleware Tests")
struct RefreshTokenMiddlewareTests {
    let mockSessionToken = "mock-session-token-12345"
    let mockAuthToken = "mock-jwt-token-67890"

    // MARK: - Test Session Token Injection

    @Test("Should add session token to Authorization header for token refresh endpoint")
    func testAddsSessionTokenForRefreshEndpoint() async throws {
        let credentials = Credentials(
            authToken: mockAuthToken,
            expiryDate: Date().addingTimeInterval(3600),
            sessionToken: mockSessionToken,
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date()
        )

        let getter = MockCredentialsGetter(credentials: credentials)
        let middleware = RefreshTokenMiddleware(credentialsGetter: getter)

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            capturedRequest = request
            return (HTTPResponse(status: .ok), nil)
        }

        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/app-api/auth/token")
        let baseURL = URL(string: "http://localhost:8080")!

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthToken.id,
            next: next
        )

        #expect(capturedRequest != nil)
        #expect(capturedRequest?.headerFields[.authorization] == "Bearer \(mockSessionToken)")
    }

    @Test("Should not modify request for non-token-refresh endpoints")
    func testDoesNotModifyOtherEndpoints() async throws {
        let credentials = Credentials(
            authToken: mockAuthToken,
            expiryDate: Date().addingTimeInterval(3600),
            sessionToken: mockSessionToken,
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date()
        )

        let getter = MockCredentialsGetter(credentials: credentials)
        let middleware = RefreshTokenMiddleware(credentialsGetter: getter)

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            capturedRequest = request
            return (HTTPResponse(status: .ok), nil)
        }

        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/app-api/auth/session")
        let baseURL = URL(string: "http://localhost:8080")!

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: "get/app-api/auth/session",
            next: next
        )

        #expect(capturedRequest != nil)
        #expect(capturedRequest?.headerFields[.authorization] == nil)
    }

    @Test("Should handle missing credentials gracefully")
    func testHandlesMissingCredentials() async throws {
        let getter = MockCredentialsGetter(credentials: nil)
        let middleware = RefreshTokenMiddleware(credentialsGetter: getter)

        var nextWasCalled = false
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            nextWasCalled = true
            return (HTTPResponse(status: .ok), nil)
        }

        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/app-api/auth/token")
        let baseURL = URL(string: "http://localhost:8080")!

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthToken.id,
            next: next
        )

        #expect(nextWasCalled)
    }

    @Test("Should use session token, not auth token")
    func testUsesSessionTokenNotAuthToken() async throws {
        let differentAuthToken = "different-jwt-token"
        let credentials = Credentials(
            authToken: differentAuthToken,
            expiryDate: Date().addingTimeInterval(3600),
            sessionToken: mockSessionToken,
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date()
        )

        let getter = MockCredentialsGetter(credentials: credentials)
        let middleware = RefreshTokenMiddleware(credentialsGetter: getter)

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            capturedRequest = request
            return (HTTPResponse(status: .ok), nil)
        }

        let request = HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/app-api/auth/token")
        let baseURL = URL(string: "http://localhost:8080")!

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthToken.id,
            next: next
        )

        #expect(capturedRequest != nil)
        let authHeader = capturedRequest?.headerFields[.authorization]
        #expect(authHeader == "Bearer \(mockSessionToken)")
        #expect(authHeader != "Bearer \(differentAuthToken)")
    }
}

// MARK: - Mock Helpers

struct MockCredentialsGetter: CredentialsGetter {
    let credentials: Credentials?

    func get() -> Credentials? {
        credentials
    }
}
