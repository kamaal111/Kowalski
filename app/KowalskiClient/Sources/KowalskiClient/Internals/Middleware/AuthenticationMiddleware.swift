//
//  AuthenticationMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import HTTPTypes
import Foundation
import KamaalUtils
import KamaalLogger
import OpenAPIRuntime

private let logger = KamaalLogger(from: AuthenticationMiddleware.self, failOnError: true)

struct AuthenticationMiddleware {
    let keychainKey: String

    private let credentialsGetter: CredentialsGetter
    private let authClient: KowalskiAuthClient

    init(keychainKey: String, credentialsGetter: CredentialsGetter, authClient: KowalskiAuthClient) {
        self.keychainKey = keychainKey
        self.credentialsGetter = credentialsGetter
        self.authClient = authClient
    }
}

// MARK: - ClientMiddleware

extension AuthenticationMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        guard let credentials = credentialsGetter.get() else {
            logger.info("No credentials found, proceeding without auth")
            return try await next(request, body, baseURL)
        }

        if credentials.isExpired {
            logger.info("JWT expired, deleting from keychain")
            Keychain.delete(forKey: keychainKey)
            return try await next(request, body, baseURL)
        }

        if credentials.shouldUpdateSession() || credentials.willExpireSoon() {
            return try await refreshToken(request: request, body: body, baseURL: baseURL, next: next)
        }

        return try await addTokenToRequest(credentials, request: request, body: body, baseURL: baseURL, next: next)
    }

    private func refreshToken(
        request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        do {
            try await authClient.refreshToken().get()
        } catch {
            logger.error(label: "Failed to refresh token", error: error)
            return try await next(request, body, baseURL)
        }

        guard let refreshedCredentials = credentialsGetter.get() else {
            logger.warning("Failed to get credentials after refresh")
            assertionFailure("We already had the token, so it should be present now too")
            return try await next(request, body, baseURL)
        }

        return try await addTokenToRequest(
            refreshedCredentials,
            request: request,
            body: body,
            baseURL: baseURL,
            next: next
        )
    }

    private func addTokenToRequest(
        _ credentials: Credentials,
        request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let tokenPreview = credentials.authToken.prefix(8)
        logger.info("Adding JWT to request: \(tokenPreview)...")
        logger.info("JWT expires at: \(credentials.expiryDate)")
        logger.info("Session last updated: \(credentials.lastSessionUpdate)")

        let signedRequest = RequestSigner.sign(request, with: credentials)
        return try await next(signedRequest, body, baseURL)
    }
}
