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

    func signUp(name: String, email: String, password: String) async -> Result<Void, KowalskiAuthSignUpErrors>

    func signIn(email: String, password: String) async -> Result<Void, KowalskiAuthSignInErrors>

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors>
}

// MARK: Errors

public enum KowalskiAuthSignUpErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case badRequest
    case conflict
}

public enum KowalskiAuthSignInErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
    case badRequest
}

public enum KowalskiAuthSessionErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
}

// MARK: Responses

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

// MARK: Implementation

struct KowalskiAuthClientImpl: KowalskiAuthClient {
    let credentialsKeychainKey: String

    private let client: Client
    private let jsonEncoder: JSONEncoder
    private let credentialsGetter: CredentialsGetter

    init(client: Client, credentialsKeychainKey: String, credentialsGetter: CredentialsGetter) {
        self.client = client
        self.credentialsKeychainKey = credentialsKeychainKey
        self.jsonEncoder = JSONEncoder()
        self.credentialsGetter = credentialsGetter
    }

    // MARK: Sign Up

    func signUp(name: String, email: String, password: String) async -> Result<Void, KowalskiAuthSignUpErrors> {
        let response: Operations.PostApiAuthSignUpEmail.Output
        do {
            response = try await client.postApiAuthSignUpEmail(
                body: .json(.init(email: email, password: password, name: name))
            )
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.PostApiAuthSignUpEmail.Output.Created
        switch response {
        case .badRequest:
            return .failure(.badRequest)
        case .conflict:
            return .failure(.conflict)
        case let .undocumented(statusCode: statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .created(created):
            payload = created
        }

        do {
            try setInitialCredentials(
                email: email,
                token: payload.headers.setAuthToken,
                expiryTime: payload.headers.setAuthTokenExpiry
            )
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(())
    }

    // MARK: Sign In

    func signIn(
        email: String,
        password: String
    ) async -> Result<Void, KowalskiAuthSignInErrors> {
        let response: Operations.PostApiAuthSignInEmail.Output
        do {
            response = try await client.postApiAuthSignInEmail(body: .json(.init(email: email, password: password)))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.PostApiAuthSignInEmail.Output.Ok
        switch response {
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case .unauthorized:
            return .failure(.unauthorized)
        case .badRequest:
            return .failure(.badRequest)
        case let .ok(ok):
            payload = ok
        }

        do {
            try setInitialCredentials(
                email: email,
                token: payload.headers.setAuthToken,
                expiryTime: payload.headers.setAuthTokenExpiry
            )
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(())
    }

    // MARK: Session

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        guard let credentials = credentialsGetter.get() else {
            assertionFailure("Should have credentials if calling session")
            return .failure(.unauthorized)
        }

        let response: Operations.GetApiAuthSession.Output
        do {
            response = try await client.getApiAuthSession()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.GetApiAuthSession.Output.Ok
        switch response {
        case .notFound:
            Keychain.delete(forKey: credentialsKeychainKey)
            return .failure(.unauthorized)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            payload = ok
        }

        let jsonPayload: Components.Schemas.SessionResponse
        do {
            jsonPayload = try payload.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
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
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        Keychain.set(newCredentialsData, forKey: credentialsKeychainKey)

        return .success(session)
    }

    private func setInitialCredentials(email:String, token: String, expiryTime expiryTimeString: String) throws {
        let expiryTime = Date.now.timeIntervalSince1970 + TimeInterval(Int(expiryTimeString)!)
        let expiryDate = Date(timeIntervalSince1970: expiryTime)
        let credentials = Credentials(email: email, authToken: token, expiryDate: expiryDate)
        let credentialsData = try jsonEncoder.encode(credentials)
        Keychain.set(credentialsData, forKey: credentialsKeychainKey)
    }
}
