//
//  RefreshTokenMiddlewareTests.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 14/12/25.
//

import Foundation
import HTTPTypes
@testable import KowalskiClient
import OpenAPIRuntime
import Testing

struct RefreshTokenMiddlewareTests {
    private let mockSessionToken = "mock-session-token-12345"
    private let mockAuthToken = "mock-jwt-token-67890"
    private let baseURL = URL(string: "http://localhost:8080")!

    // MARK: - Test Session Token Injection

    @Test
    func `Should add session token to Authorization header for token refresh endpoint`() async throws {
        let credentials = makeCredentials()
        let middleware = makeMiddleware(with: credentials)

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            capturedRequest = request
            return (HTTPResponse(status: .ok), nil)
        }
        let request = makeRequest(path: "/app-api/auth/token")

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthToken.id,
            next: next,
        )

        #expect(capturedRequest != nil)
        #expect(capturedRequest?.headerFields[.authorization] == "Bearer \(mockSessionToken)")
    }

    @Test
    func `Should not modify request for non-token-refresh endpoints`() async throws {
        let credentials = makeCredentials()
        let middleware = makeMiddleware(with: credentials)

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            capturedRequest = request
            return (HTTPResponse(status: .ok), nil)
        }
        let request = makeRequest(path: "/app-api/auth/session")

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthSession.id,
            next: next,
        )

        #expect(capturedRequest != nil)
        #expect(capturedRequest?.headerFields[.authorization] == nil)
    }

    @Test
    func `Should handle missing credentials gracefully`() async throws {
        let middleware = makeMiddleware(with: nil)

        var nextWasCalled = false
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { _, _, _ in
            nextWasCalled = true
            return (HTTPResponse(status: .ok), nil)
        }

        let request = makeRequest(path: "/app-api/auth/token")

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthToken.id,
            next: next,
        )

        #expect(nextWasCalled)
    }

    @Test
    func `Should use session token, not auth token`() async throws {
        let differentAuthToken = "different-jwt-token"
        let credentials = makeCredentials(authToken: differentAuthToken)
        let middleware = makeMiddleware(with: credentials)

        var capturedRequest: HTTPRequest?
        let next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?) = { request, _, _ in
            capturedRequest = request
            return (HTTPResponse(status: .ok), nil)
        }
        let request = makeRequest(path: "/app-api/auth/token")

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: baseURL,
            operationID: Operations.GetAppApiAuthToken.id,
            next: next,
        )

        #expect(capturedRequest != nil)
        let authHeader = capturedRequest?.headerFields[.authorization]
        #expect(authHeader == "Bearer \(mockSessionToken)")
    }

    // MARK: - Helpers

    private func makeCredentials(
        authToken: String? = nil,
        sessionToken: String? = nil,
    ) -> Credentials {
        Credentials(
            authToken: authToken ?? mockAuthToken,
            expiryDate: Date().addingTimeInterval(3600),
            sessionToken: sessionToken ?? mockSessionToken,
            sessionUpdateAge: 86400,
            lastSessionUpdate: Date(),
        )
    }

    private func makeMiddleware(with credentials: Credentials?) -> RefreshTokenMiddleware {
        let getter = MockCredentialsGetter(credentials: credentials)
        return RefreshTokenMiddleware(credentialsGetter: getter)
    }

    private func makeRequest(path: String, method: HTTPRequest.Method = .get) -> HTTPRequest {
        HTTPRequest(method: method, scheme: nil, authority: nil, path: path)
    }
}
