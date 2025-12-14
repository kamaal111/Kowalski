//
//  RefreshTokenMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 14/12/25.
//

import Foundation
import HTTPTypes
import KamaalLogger
import OpenAPIRuntime

private let logger = KamaalLogger(from: RefreshTokenMiddleware.self, failOnError: true)

struct RefreshTokenMiddleware {
    private let credentialsGetter: CredentialsGetter

    init(credentialsGetter: CredentialsGetter) {
        self.credentialsGetter = credentialsGetter
    }
}

// MARK: - ClientMiddleware

extension RefreshTokenMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        guard operationID == Operations.GetAppApiAuthToken.id else {
            return try await next(request, body, baseURL)
        }
        guard let credentials = credentialsGetter.get() else {
            logger.warning("No credentials found for token refresh")
            return try await next(request, body, baseURL)
        }

        var request = request
        request.headerFields[.authorization] = "Bearer \(credentials.sessionToken)"
        logger.info("Adding session token to refresh request")

        return try await next(request, body, baseURL)
    }
}
