//
//  KowalskiAuth.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation
import KamaalLogger
import KamaalUtils
import KowalskiClient
import KowalskiUtils
import Observation

@MainActor
@Observable
public final class KowalskiAuth {
    package private(set) var session: UserSession?

    private(set) var initiallyValidatingToken: Bool

    private let client: KowalskiClient
    private let mapper = KowalskiAuthMappers()
    private let logger = KamaalLogger(from: KowalskiAuth.self, failOnError: true)

    @UserDefaultsObject(key: "\(ModuleConfig.identifier).cachedSession")
    private static var cachedSession: CachedUserSession?

    private init(client: KowalskiClient) {
        self.client = client
        if client.hasValidCredentials {
            initiallyValidatingToken = true
            Task {
                await loadSession()
                initiallyValidatingToken = false
            }
        } else {
            initiallyValidatingToken = false
        }
    }

    private init(client: KowalskiClient, withCredentials: Bool) {
        self.client = client
        initiallyValidatingToken = false
        if withCredentials {
            let oneDay: TimeInterval = 86400
            session = UserSession(
                name: "Yami Sukehiro",
                email: "yami@bull.io",
                expiresAt: Date.now.addingTimeInterval(oneDay),
            )
        }
        Task { await loadSession() }
    }

    package var isLoggedIn: Bool {
        session != nil
    }

    // MARK: - Sign Up

    func signUp(_ payload: SignUpPayload) async -> Result<Void, KowalskiAuthSignUpErrors> {
        let signUpResult = await client.auth.signUp(
            name: payload.name,
            email: payload.email,
            password: payload.password,
        )
        .mapError { error -> KowalskiAuthSignUpErrors in
            switch error {
            case .unknown:
                logger.error(label: "Failed to sign up", error: error)
                return .generalFailure(context: error)
            case .badRequest:
                return .invalidCredentials(context: error)
            case .conflict:
                return .userAlreadyExists(context: error)
            }
        }
        switch signUpResult {
        case let .failure(failure): return .failure(failure)
        case .success: break
        }

        return await loadSession()
            .mapError { error -> KowalskiAuthSignUpErrors in
                switch error {
                case .serverUnavailable, .unauthorized:
                    logger.error(label: "Failed to load session", error: error)
                    return .generalFailure(context: error)
                }
            }
    }

    // MARK: - Sign In

    func signIn(_ payload: SignInPayload) async -> Result<Void, KowalskiAuthSignInErrors> {
        let signInResult = await client.auth.signIn(email: payload.email, password: payload.password)
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

    // MARK: Factory

    public static func forEnvironment() -> KowalskiAuth {
        KowalskiEnvironment.isUiTesting
            ? preview(withCredentials: true)
            : `default`()
    }

    public static func `default`() -> KowalskiAuth {
        let client = KowalskiClient.default()

        return KowalskiAuth(client: client)
    }

    public static func preview(withCredentials: Bool) -> KowalskiAuth {
        let client = KowalskiClient.preview(withCredentials: withCredentials)

        return KowalskiAuth(client: client, withCredentials: withCredentials)
    }

    @discardableResult
    private func loadSession() async -> Result<Void, KowalskiAuthSessionErrors> {
        if let cachedSession = getCachedSessionIfLoadedToday() {
            setSession(cachedSession)
            return .success(())
        }

        let result = await client.auth.session()
            .map(mapper.mapSessionResponse)
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
        cacheSession(session)

        return .success(())
    }

    @MainActor
    private func setSession(_ session: UserSession) {
        self.session = session
    }

    private func getCachedSessionIfLoadedToday() -> UserSession? {
        guard let cachedSession = Self.cachedSession else { return nil }

        let calendar = Calendar.current
        let now = Date.now
        let sessionHasBeenCachedToday = calendar.isDate(cachedSession.cachedAt, inSameDayAs: now)
        guard sessionHasBeenCachedToday else { return nil }
        guard !cachedSession.session.isExpired else { return nil }

        return cachedSession.session
    }

    private func cacheSession(_ session: UserSession) {
        Self.cachedSession = CachedUserSession(session: session, cachedAt: .now)
    }
}

// MARK: - Errors

enum KowalskiAuthSignInErrors: Error {
    case invalidCredentials(context: Error)
    case generalFailure(context: Error)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            NSLocalizedString("Invalid credentials provided.", bundle: .module, comment: "")
        case .generalFailure:
            NSLocalizedString("Failed to log in.", bundle: .module, comment: "")
        }
    }
}

enum KowalskiAuthSignUpErrors: Error {
    case invalidCredentials(context: Error)
    case userAlreadyExists(context: Error)
    case generalFailure(context: Error)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            NSLocalizedString("Invalid credentials provided.", bundle: .module, comment: "")
        case .userAlreadyExists:
            NSLocalizedString("User already exists", bundle: .module, comment: "")
        case .generalFailure:
            NSLocalizedString("Failed to sign up.", bundle: .module, comment: "")
        }
    }
}

private enum KowalskiAuthSessionErrors: Error {
    case serverUnavailable(context: Error?)
    case unauthorized(context: Error?)
}

private struct CachedUserSession: Codable {
    let session: UserSession
    let cachedAt: Date
}
