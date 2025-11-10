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

    private let client: KowalskiClient
    private let logger = KamaalLogger(from: KowalskiAuth.self, failOnError: true)
    private let jsonDecoder = JSONDecoder()
    private let jsonEncoder = JSONEncoder()
    private let sessionCacheKey = "com.kowalski.auth.cachedSession"
    private let sessionCacheTimestampKey = "com.kowalski.auth.cachedSessionTimestamp"

    private init(client: KowalskiClient) {
        self.client = client
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

    private init(client: KowalskiClient, withCredentials: Bool) {
        self.client = client
        self.initiallyValidatingToken = false
        if withCredentials {
            let oneDay: TimeInterval = 86400
            self.session = UserSession(name: "Yami Sukehiro", expiresAt: Date.now.addingTimeInterval(oneDay))
        }
        Task { await loadSession() }
    }

    var isLoggedIn: Bool {
        session != nil
    }

    // MARK: - Sign Up

    func signUp(_ payload: SignUpPayload) async -> Result<Void, KowalskiAuthSignUpErrors> {
        let signUpResult = await client.auth.signUp(
            name: payload.name,
            email: payload.email,
            password: payload.password
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
        // Check if we have a cached session from today
        if let cachedSession = getCachedSessionIfLoadedToday() {
            setSession(cachedSession)
            return .success(())
        }
        
        // Load from server
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
        cacheSession(session)

        return .success(())
    }

    @MainActor
    private func setSession(_ session: UserSession) {
        self.session = session
    }
    
    private func getCachedSessionIfLoadedToday() -> UserSession? {
        guard let cachedSessionData = UserDefaults.standard.data(forKey: sessionCacheKey),
              let cachedSession = try? jsonDecoder.decode(UserSession.self, from: cachedSessionData),
              let cacheTimestamp = UserDefaults.standard.object(forKey: sessionCacheTimestampKey) as? Date else {
            return nil
        }
        
        // Check if the cached session was loaded today
        let calendar = Calendar.current
        let now = Date.now
        if calendar.isDate(cacheTimestamp, inSameDayAs: now) {
            return cachedSession
        }
        
        return nil
    }
    
    private func cacheSession(_ session: UserSession) {
        guard let sessionData = try? jsonEncoder.encode(session) else {
            logger.error(label: "Failed to encode session for caching")
            return
        }
        
        UserDefaults.standard.set(sessionData, forKey: sessionCacheKey)
        UserDefaults.standard.set(Date.now, forKey: sessionCacheTimestampKey)
    }
}

// MARK: - Errors

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

enum KowalskiAuthSignUpErrors: Error {
    case invalidCredentials(context: Error)
    case userAlreadyExists(context: Error)
    case generalFailure(context: Error)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return NSLocalizedString("Invalid credentials provided.", bundle: .module, comment: "")
        case .userAlreadyExists:
            return NSLocalizedString("User already exists", bundle: .module, comment: "")
        case .generalFailure:
            return NSLocalizedString("Failed to sign up.", bundle: .module, comment: "")
        }
    }
}

private enum KowalskiAuthSessionErrors: Error {
    case serverUnavailable(context: Error?)
    case unauthorized(context: Error?)
}
