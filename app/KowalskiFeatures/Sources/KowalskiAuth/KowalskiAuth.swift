//
//  KowalskiAuth.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation
import Observation
import KamaalLogger
import KowalskiClient

@MainActor
@Observable
public final class KowalskiAuth {
    private(set) var initiallyValidatingToken: Bool
    private(set) var session: UserSession?

    private let client = KowalskiClient()
    private let logger = KamaalLogger(from: KowalskiAuth.self, failOnError: true)
    private let jsonDecoder = JSONDecoder()

    public init() {
        if client.hasValidCredentials {
            self.initiallyValidatingToken = true
            Task {
                await loadSession()
                initiallyValidatingToken = false
            }
        } else {
            self.initiallyValidatingToken = false
        }
    }

    var isLoggedIn: Bool {
        session != nil
    }

    func signIn(email: String, password: String) async -> Result<Void, KowalskiAuthSignInErrors> {
        assert(email.trimmingCharacters(in: .whitespacesAndNewlines).count == email.count)
        assert(!email.isEmpty)
        assert(!password.isEmpty)

        let signInResult = await client.auth.signIn(email: email, password: password)
            .mapError { error -> KowalskiAuthSignInErrors in
                switch error {
                case .unknown, .badRequest:
                    logger.error(label: "Failed to sign in", error: error)
                    return .generalFailure(context: error)
                case .unauthorized:
                    return .invalidCredentials(context: error)
                }
            }
        switch signInResult {
        case let .failure(failure): return .failure(failure)
        case .success: break
        }

        return await loadSession()
            .mapError { error -> KowalskiAuthSignInErrors in
                switch error {
                case .serverUnavailable, .unauthorized:
                    logger.error(label: "Failed to load session", error: error)
                    return .generalFailure(context: error)
                }
            }
    }

    @discardableResult
    private func loadSession() async -> Result<Void, KowalskiAuthSessionErrors> {
        let result = await client.auth.session()
            .map { UserSession(name: $0.name, expiresAt: $0.expiresAt) }
            .mapError { error -> KowalskiAuthSessionErrors in
                switch error {
                case .unknown:
                    logger.error(label: "Failed to get session", error: error)
                    return .serverUnavailable(context: error)
                case .unauthorized: return .unauthorized(context: error)
                }
            }
        let session: UserSession
        switch result {
        case let .failure(failure): return .failure(failure)
        case let .success(success): session = success
        }

        setSession(session)

        return .success(())
    }

    @MainActor
    private func setSession(_ session: UserSession) {
        self.session = session
    }
}

enum KowalskiAuthSignInErrors: Error {
    case invalidCredentials(context: Error)
    case generalFailure(context: Error)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return NSLocalizedString("Invalid credentials provided.", bundle: .module, comment: "")
        case .generalFailure:
            return NSLocalizedString("Failed to log in.", bundle: .module, comment: "")
        }
    }
}

private enum KowalskiAuthSessionErrors: Error {
    case serverUnavailable(context: Error?)
    case unauthorized(context: Error?)
}
