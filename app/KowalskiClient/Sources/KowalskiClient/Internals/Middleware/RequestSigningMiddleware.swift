//
//  RequestSigningMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/19/25.
//

import HTTPTypes
import Foundation
import KamaalUtils
import KamaalLogger
import OpenAPIRuntime

private let logger = KamaalLogger(from: RequestSigningMiddleware.self, failOnError: true)

struct RequestSigningMiddleware {
    let keychainKey: String
    private let credentialsGetter: CredentialsGetter

    init(keychainKey: String, credentialsGetter: CredentialsGetter) {
        self.keychainKey = keychainKey
        self.credentialsGetter = credentialsGetter
    }
}

// MARK: - ClientMiddleware

extension RequestSigningMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        guard let credentials = credentialsGetter.get() else {
            return try await next(request, body, baseURL)
        }

        if credentials.isExpired {
            logger.info("JWT expired, deleting from keychain")
            Keychain.delete(forKey: keychainKey)
            return try await next(request, body, baseURL)
        }

        let tokenPreview = credentials.authToken.prefix(8)
        logger.info("Adding JWT to request: \(tokenPreview)...")
        logger.info("JWT expires at: \(credentials.expiryDate)")
        logger.info("Session last updated: \(credentials.lastSessionUpdate)")

        let signedRequest = RequestSigner.sign(request, with: credentials)
        return try await next(signedRequest, body, baseURL)
    }
}
