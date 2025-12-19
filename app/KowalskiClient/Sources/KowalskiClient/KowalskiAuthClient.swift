//
//  KowalskiAuthClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 9/13/25.
//

import Foundation
import KamaalLogger
import KamaalUtils
import OpenAPIRuntime

private let logger = KamaalLogger(from: KowalskiAuthClientImpl.self, failOnError: true)

// MARK: Protocol

public protocol KowalskiAuthClient: Sendable {
    func signUp(name: String, email: String, password: String) async -> Result<Void, KowalskiAuthSignUpErrors>

    func signIn(email: String, password: String) async -> Result<Void, KowalskiAuthSignInErrors>

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors>

    func refreshToken() async -> Result<Void, KowalskiAuthRefreshErrors>
}

// MARK: Factory

struct KowalskiAuthClientFactory {
    private init() {}

    static func `default`(
        client: Client,
        credentialsKeychainKey: String,
        credentialsGetter: CredentialsGetter
    ) -> KowalskiAuthClient {
        KowalskiAuthClientImpl(
            client: client,
            credentialsKeychainKey: credentialsKeychainKey,
            credentialsGetter: credentialsGetter
        )
    }

    static func preview() -> KowalskiAuthClient {
        KowalskiAuthClientPreview()
    }
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

public enum KowalskiAuthRefreshErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
}

// MARK: Implementation

struct KowalskiAuthClientImpl: KowalskiAuthClient {
    let credentialsKeychainKey: String

    private let client: Client
    private let jsonEncoder: JSONEncoder
    private let credentialsGetter: CredentialsGetter
    private let mapper: KowalskiAuthMapper

    fileprivate init(client: Client, credentialsKeychainKey: String, credentialsGetter: CredentialsGetter) {
        self.client = client
        self.credentialsKeychainKey = credentialsKeychainKey
        self.jsonEncoder = JSONEncoder()
        self.credentialsGetter = credentialsGetter
        self.mapper = KowalskiAuthMapper()
    }

    // MARK: Sign Up

    func signUp(name: String, email: String, password: String) async -> Result<Void, KowalskiAuthSignUpErrors> {
        assert(
            (try? Keychain.get(forKey: credentialsKeychainKey).get()) == nil, "There should not be a key chain entry")
        Keychain.delete(forKey: credentialsKeychainKey)

        let response: Operations.PostAppApiAuthSignUpEmail.Output
        do {
            response = try await client.postAppApiAuthSignUpEmail(
                body: .json(.init(email: email, password: password, name: name))
            )
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.PostAppApiAuthSignUpEmail.Output.Created
        switch response {
        case .badRequest, .unauthorized:
            return .failure(.badRequest)
        case .conflict:
            return .failure(.conflict)
        case .undocumented(let statusCode, let payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case .created(let created):
            payload = created
        }

        do {
            try storeCredentials(
                token: payload.headers.setAuthToken,
                expiryTime: payload.headers.setAuthTokenExpiry,
                sessionToken: payload.headers.setSessionToken,
                sessionUpdateAge: payload.headers.setSessionUpdateAge
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
        assert(
            (try? Keychain.get(forKey: credentialsKeychainKey).get()) == nil, "There should not be a key chain entry")
        Keychain.delete(forKey: credentialsKeychainKey)

        let response: Operations.PostAppApiAuthSignInEmail.Output
        do {
            response = try await client.postAppApiAuthSignInEmail(body: .json(.init(email: email, password: password)))
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.PostAppApiAuthSignInEmail.Output.Ok
        switch response {
        case .undocumented(let statusCode, let payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case .unauthorized:
            return .failure(.unauthorized)
        case .badRequest:
            return .failure(.badRequest)
        case .ok(let ok):
            payload = ok
        }

        do {
            try storeCredentials(
                token: payload.headers.setAuthToken,
                expiryTime: payload.headers.setAuthTokenExpiry,
                sessionToken: payload.headers.setSessionToken,
                sessionUpdateAge: payload.headers.setSessionUpdateAge
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

        let response: Operations.GetAppApiAuthSession.Output
        do {
            response = try await client.getAppApiAuthSession()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.GetAppApiAuthSession.Output.Ok
        switch response {
        case .notFound:
            Keychain.delete(forKey: credentialsKeychainKey)
            return .failure(.unauthorized)
        case .undocumented(let statusCode, let payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case .ok(let ok):
            payload = ok
        }

        let jsonPayload: Components.Schemas.SessionResponse
        do {
            jsonPayload = try payload.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        let session = mapper.mapSessionResponse(jsonPayload)
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

    // MARK: Refresh Token

    func refreshToken() async -> Result<Void, KowalskiAuthRefreshErrors> {
        let response: Operations.GetAppApiAuthToken.Output
        do {
            response = try await client.getAppApiAuthToken()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.GetAppApiAuthToken.Output.Ok
        switch response {
        case .unauthorized:
            Keychain.delete(forKey: credentialsKeychainKey)
            return .failure(.unauthorized)
        case .undocumented(let statusCode, let payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case .ok(let ok):
            payload = ok
        }

        do {
            try storeCredentials(
                token: payload.headers.setAuthToken,
                expiryTime: payload.headers.setAuthTokenExpiry,
                sessionToken: payload.headers.setSessionToken,
                sessionUpdateAge: payload.headers.setSessionUpdateAge
            )
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(())
    }

    private func storeCredentials(
        token: String,
        expiryTime expiryTimeString: String,
        sessionToken: String,
        sessionUpdateAge sessionUpdateAgeString: String
    ) throws {
        let expiryTime = Date.now.timeIntervalSince1970 + TimeInterval(Int(expiryTimeString)!)
        let expiryDate = Date(timeIntervalSince1970: expiryTime)
        let sessionUpdateAge = TimeInterval(Int(sessionUpdateAgeString)!)

        logger.info("Storing JWT: \(String(token.prefix(7)))...")
        logger.info("Session token: \(String(sessionToken.prefix(7)))... (length: \(sessionToken.count))")

        assert(token.split(separator: ".").count == 3)

        let credentials = Credentials(
            authToken: token,
            expiryDate: expiryDate,
            sessionToken: sessionToken,
            sessionUpdateAge: sessionUpdateAge,
            lastSessionUpdate: .now
        )
        let credentialsData = try jsonEncoder.encode(credentials)
        Keychain.set(credentialsData, forKey: credentialsKeychainKey)
    }
}

// MARK: Preview

struct KowalskiAuthClientPreview: KowalskiAuthClient {
    fileprivate init() {}

    func signUp(name: String, email: String, password: String) async -> Result<Void, KowalskiAuthSignUpErrors> {
        .success(())
    }

    func signIn(email: String, password: String) async -> Result<Void, KowalskiAuthSignInErrors> {
        .success(())
    }

    func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        .success(
            .init(
                name: "Yami Sukehiro",
                email: "yami@bulls.io",
                expiresAt: Date(timeIntervalSince1970: 1_762_088_596)
            ))
    }

    func refreshToken() async -> Result<Void, KowalskiAuthRefreshErrors> {
        .success(())
    }
}
