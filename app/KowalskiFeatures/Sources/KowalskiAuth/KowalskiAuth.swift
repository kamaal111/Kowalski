//
//  KowalskiAuth.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation
import KamaalAuth
import KamaalLogger
import KamaalUtils
import KowalskiClient
import KowalskiFeaturesConfig
import KowalskiModels
import KowalskiUtils
import Observation

/// Owns Kowalski's own session state — the `preferred_currency` extension `KamaalAuth` knows nothing about.
///
/// `KamaalAuth` (from the shared `kamaal-auth` package) owns credentials, the refresh policy, and the shared
/// sign-in/sign-up UI via `.kamaalAuth(auth.kamaalAuth)`. This wrapper observes it to know when a session became
/// available, then loads Kowalski's richer session (with `preferred_currency`) over the same authorized client.
@MainActor
@Observable
public final class KowalskiAuth {
    public let kamaalAuth: KamaalAuth

    package private(set) var session: UserSession?

    private let client: KowalskiClient
    private let mapper = KowalskiAuthMappers()
    private let logger = KamaalLogger(from: KowalskiAuth.self, failOnError: true)
    @ObservationIgnored private var sessionStateTask: Task<Void, Never>?

    @UserDefaultsObject(key: "\(ModuleConfig.identifier).cachedSession")
    private static var cachedSession: CachedUserSession?

    private init(client: KowalskiClient, kamaalAuth: KamaalAuth, tracksSessionStates: Bool = true) {
        self.client = client
        self.kamaalAuth = kamaalAuth
        if tracksSessionStates {
            trackSessionStates()
        }
    }

    var initiallyValidatingToken: Bool {
        kamaalAuth.initiallyValidatingToken
    }

    package var isLoggedIn: Bool {
        kamaalAuth.isLoggedIn
    }

    /// The currency the app should use for new transaction defaults.
    /// Priority: server-resolved preference → app fallback currency.
    public var effectiveCurrency: KowalskiCurrency {
        guard let preferredCurrency = session?.preferredCurrency
        else { return KowalskiFeatureDefaults.fallbackCurrency }

        return preferredCurrency
    }

    // MARK: - Preferences

    public func updatePreferredCurrency(
        _ currency: KowalskiCurrency,
    ) async -> Result<Void, KowalskiAuthPreferenceErrors> {
        let result = await client.updatePreferences(preferredCurrency: currency)
        switch result {
        case let .failure(failure):
            logger.error(label: "Failed to update preferences", error: failure)
            return .failure(.generalFailure(context: failure))
        case let .success(response):
            let updatedSession = mapper.mapSessionResponse(response)
            setSession(updatedSession)
            cacheSession(updatedSession)

            return .success(())
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
        let kamaalAuth = KamaalAuth(
            client: client.auth,
            configuration: KamaalAuthConfiguration(appName: "Kowalski", storageNamespace: ModuleConfig.identifier),
        )

        return KowalskiAuth(client: client, kamaalAuth: kamaalAuth)
    }

    public static func preview(withCredentials: Bool) -> KowalskiAuth {
        let client = KowalskiClient.preview(withCredentials: withCredentials)
        let kamaalAuth = KamaalAuth(
            client: client.auth,
            configuration: KamaalAuthConfiguration(appName: "Kowalski", storageNamespace: ModuleConfig.identifier),
        )
        let auth = KowalskiAuth(client: client, kamaalAuth: kamaalAuth)
        if withCredentials {
            let oneDay: TimeInterval = 86400
            auth.session = UserSession(
                name: "Yami Sukehiro",
                email: "yami@bull.io",
                expiresAt: Date.now.addingTimeInterval(oneDay),
                preferredCurrency: KowalskiFeatureDefaults.fallbackCurrency,
                hasPreferredCurrencyPreference: true,
            )
        }

        return auth
    }

    static func testing(
        client: KowalskiClient, session: UserSession? = nil, tracksSessionStates: Bool = false,
    ) -> KowalskiAuth {
        let kamaalAuth = KamaalAuth(
            client: client.auth,
            configuration: KamaalAuthConfiguration(appName: "Kowalski", storageNamespace: ModuleConfig.identifier),
        )
        let auth = KowalskiAuth(
            client: client, kamaalAuth: kamaalAuth, tracksSessionStates: tracksSessionStates,
        )
        auth.session = session

        return auth
    }

    // MARK: - Session

    @discardableResult
    package func loadSession() async -> Result<Void, KowalskiAuthFeatureSessionError> {
        if let cachedSession = getCachedSessionIfLoadedToday() {
            setSession(cachedSession)
            await seedPreferredCurrencyIfNeeded(for: cachedSession)
            return .success(())
        }

        let result = await client.session()
            .map(mapper.mapSessionResponse)
            .mapError { error -> KowalskiAuthFeatureSessionError in
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
        await seedPreferredCurrencyIfNeeded(for: session)

        return .success(())
    }

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

    private func seedPreferredCurrencyIfNeeded(for session: UserSession) async {
        guard !session.hasPreferredCurrencyPreference else { return }
        guard let localeCurrency = Self.localeCurrency else { return }
        guard localeCurrency != session.preferredCurrency else { return }

        let result = await updatePreferredCurrency(localeCurrency)
        switch result {
        case let .failure(failure):
            logger.error(label: "Failed to seed preferred currency; will retry next session load", error: failure)
        case .success: break
        }
    }

    static var localeCurrency: KowalskiCurrency? {
        localeCurrencyProvider()
    }

    static var localeCurrencyProvider: () -> KowalskiCurrency? = {
        guard let currencyCode = Locale.current.currency?.identifier else { return nil }

        return KowalskiCurrency(rawValue: currencyCode)
    }

    // MARK: - Authentication lifecycle

    private func trackSessionStates() {
        sessionStateTask = Task { @MainActor [weak self, kamaalAuth] in
            for await state in kamaalAuth.sessionStates() {
                guard let self else { return }

                await handleSessionState(state)
            }
        }
    }

    private func handleSessionState(_ state: KamaalAuthSessionState) async {
        switch state {
        case .validatingCredentials:
            break
        case .unauthenticated:
            session = nil
            Self.cachedSession = nil
        case .authenticated:
            await loadSession()
        }
    }

    deinit {
        sessionStateTask?.cancel()
    }
}

// MARK: - Errors

package enum KowalskiAuthFeatureSessionError: Error {
    case serverUnavailable(context: Error?)
    case unauthorized(context: Error?)
}

public enum KowalskiAuthPreferenceErrors: Error {
    case generalFailure(context: Error)
    case unsupportedCurrency
}
