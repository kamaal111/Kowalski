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
    public let email: String
    public let expiresAt: Date

    public init(name: String, email: String, expiresAt: Date) {
        self.name = name
        self.email = email
        self.expiresAt = expiresAt
    }
}

struct KowalskiAuthClientImpl: KowalskiAuthClient {
    let credentialsKeychainKey: String

    private let client: Client
    private let jsonEncoder: JSONEncoder
    private let credentialsGetter: CredentialsGetter

    init(client: Client, credentialsKeychainKey: String) {
        self.client = client
        self.credentialsKeychainKey = credentialsKeychainKey
        self.jsonEncoder = JSONEncoder()
        self.credentialsGetter = CredentialsGetter(keychainKey: credentialsKeychainKey)
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

        let expiryTime = Date.now.timeIntervalSince1970 + TimeInterval(Int(payload.headers.setAuthTokenExpiry)!)
        let expiryDate = Date(timeIntervalSince1970: expiryTime)
        let credentials = Credentials(email: email, authToken: payload.headers.setAuthToken, expiryDate: expiryDate)
        let credentialsData: Data
        do {
            credentialsData = try jsonEncoder.encode(credentials)
        } catch {
            assertionFailure("Valid case, should not fail here!")
            return .failure(.unknown(statusCode: 500, payload: nil))
        }
        Keychain.set(credentialsData, forKey: credentialsKeychainKey)

        return .success(())
    }

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        guard let credentials = credentialsGetter.get() else {
            assertionFailure("Should have credentials if calling session")
            return .failure(.unauthorized)
        }

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

        let session = KowalskiAuthSessionResponse(
            name: jsonPayload.user.name,
            email: jsonPayload.user.email,
            expiresAt: jsonPayload.session.expiresAt
        )
        let newCredentials = credentials.setExpiryDate(session.expiresAt)
        let newCredentialsData: Data
        do {
            newCredentialsData = try jsonEncoder.encode(newCredentials)
        } catch {
            assertionFailure("Valid case, should not fail here!")
            return .failure(.unknown(statusCode: 500, payload: nil))
        }

        Keychain.set(newCredentialsData, forKey: credentialsKeychainKey)

        return .success(session)
    }
}
