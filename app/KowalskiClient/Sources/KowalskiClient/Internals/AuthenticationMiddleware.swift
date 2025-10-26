//
//  AuthenticationMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import HTTPTypes
import Foundation
import KamaalUtils
import OpenAPIRuntime

struct AuthenticationMiddleware {
    let keychainKey: String

    private let credentialsGetter: CredentialsGetter

    init(keychainKey: String) {
        self.keychainKey = keychainKey
        self.credentialsGetter = CredentialsGetter(keychainKey: keychainKey)
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
            return try await next(request, body, baseURL)
        }

        if credentials.isExpired {
            Keychain.delete(forKey: keychainKey)
            return try await next(request, body, baseURL)
        }

        var request = request
        request.headerFields[.authorization] = "Bearer \(credentials.authToken)"

        return try await next(request, body, baseURL)
    }
}
