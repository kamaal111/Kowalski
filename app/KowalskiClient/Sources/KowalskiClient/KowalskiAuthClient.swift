//
//  KowalskiAuthClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 9/13/25.
//

import Foundation
import KamaalUtils
import OpenAPIRuntime

public protocol KowalskiAuthClient: Sendable {
    var credentialsKeychainKey: String { get }

    func signIn(
        email: String,
        password: String
    ) async -> Result<Void, KowalskiAuthSignInErrors>

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors>
}

public enum KowalskiAuthSignInErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?)
    case unauthorized
    case badRequest
}

public enum KowalskiAuthSessionErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?)
    case unauthorized
}

public struct KowalskiAuthSessionResponse: Hashable, Codable {
    public let name: String
    public let expiresAt: Date

    public init(name: String, expiresAt: Date) {
        self.name = name
        self.expiresAt = expiresAt
    }
}

struct KowalskiAuthClientImpl: KowalskiAuthClient {
    let credentialsKeychainKey: String

    private let client: Client
    private let jsonEncoder: JSONEncoder

    init(client: Client, credentialsKeychainKey: String) {
        self.client = client
        self.credentialsKeychainKey = credentialsKeychainKey
        self.jsonEncoder = JSONEncoder()
    }

    func signIn(
        email: String,
        password: String
    ) async -> Result<Void, KowalskiAuthSignInErrors> {
        let response: Operations.PostApiAuthSignInEmail.Output
        do {
            response = try await client.postApiAuthSignInEmail(body: .json(.init(email: email, password: password)))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil))
        }

        let payload: Operations.PostApiAuthSignInEmail.Output.Ok
        switch response {
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload))
        case .unauthorized:
            return .failure(.unauthorized)
        case .badRequest:
            return .failure(.badRequest)
        case let .ok(ok):
            payload = ok
        }

        let credentials = Credentials(
            email: email,
            password: password,
            authToken: payload.headers.setAuthToken,
            expiry: Int(payload.headers.setAuthTokenExpiry)!
        )
        let credentialsData: Data
        do {
            credentialsData = try jsonEncoder.encode(credentials)
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil))
        }
        Keychain.set(credentialsData, forKey: credentialsKeychainKey)

        return .success(())
    }

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        let response: Operations.GetApiAuthSession.Output
        do {
            response = try await client.getApiAuthSession()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil))
        }

        let payload: Operations.GetApiAuthSession.Output.Ok
        switch response {
        case .notFound:
            return .failure(.unauthorized)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload))
        case let .ok(ok):
            payload = ok
        }

        let jsonPayload: Components.Schemas.SessionResponse
        do {
            jsonPayload = try payload.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil))
        }

        let session = KowalskiAuthSessionResponse(name: jsonPayload.user.name, expiresAt: jsonPayload.session.expiresAt)

        return .success(session)
    }
}
