//
//  KowalskiAuthClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 9/13/25.
//

import OpenAPIRuntime

public protocol KowalskiAuthClient: Sendable {
    func signIn(
        email: String,
        password: String
    ) async throws -> Result<KowalskiAuthSignInResponse, KowalskiAuthSignInErrors>
}

public enum KowalskiAuthSignInErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload)
    case unauthorized
    case badRequest
}

public struct KowalskiAuthSignInResponse: Sendable, Hashable, Codable {
    public let authToken: String
    public let expiry: Int
}

struct KowalskiAuthClientImpl: KowalskiAuthClient {
    private let client: Client

    init(client: Client) {
        self.client = client
    }

    func signIn(
        email: String,
        password: String
    ) async throws -> Result<KowalskiAuthSignInResponse, KowalskiAuthSignInErrors> {
        let response = try await client.postApiAuthSignInEmail(body: .json(.init(email: email, password: password)))
        switch response {
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload))
        case .unauthorized:
            return .failure(.unauthorized)
        case .badRequest:
            return .failure(.badRequest)
        case let .ok(payload):
            return .success(KowalskiAuthSignInResponse(
                authToken: payload.headers.setAuthToken,
                expiry: Int(payload.headers.setAuthTokenExpiry)!
            ))
        }
    }
}
