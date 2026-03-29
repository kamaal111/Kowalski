//
//  KowalskiClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 9/13/25.
//

import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

public struct KowalskiClient: Sendable {
    public let auth: KowalskiAuthClient
    public let stocks: KowalskiStocksClient
    public let portfolio: KowalskiPortfolioClient

    private let credentialsGetter: CredentialsGetter
    private static let credentialsKeychainKey = ModuleConfig.credentialsKeychainKey

    public var hasValidCredentials: Bool {
        guard let credentials = credentialsGetter.get() else { return false }
        return !credentials.isExpired
    }

    public static func `default`() -> KowalskiClient {
        let url: URL
        do {
            url = try Servers.Server1.url()
        } catch {
            preconditionFailure("Failed to construct server URL: \(error)")
        }
        let credentialsGetter = CredentialsGetterFactory.default(keychainKey: credentialsKeychainKey)
        let auth = KowalskiAuthClientFactory.default(
            client: makeClientForAuth(url: url, credentialsGetter: credentialsGetter),
            credentialsKeychainKey: credentialsKeychainKey,
            credentialsGetter: credentialsGetter,
        )

        let client = makeClient(url: url, credentialsGetter: credentialsGetter, authClient: auth)
        let stocks = KowalskiStocksClientFactory.deafault(client: client)
        let portfolio = KowalskiPortfolioClientFactory.default(client: client)

        return KowalskiClient(auth: auth, stocks: stocks, portfolio: portfolio, credentialsGetter: credentialsGetter)
    }

    public static func preview(withCredentials: Bool) -> KowalskiClient {
        let credentialsGetter = CredentialsGetterFactory.preview(withCredentials: withCredentials)
        let auth = KowalskiAuthClientFactory.preview()
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.preview()

        return KowalskiClient(auth: auth, stocks: stocks, portfolio: portfolio, credentialsGetter: credentialsGetter)
    }

    public static func previewWithFailingPortfolioCreateEntry(withCredentials: Bool) -> KowalskiClient {
        let credentialsGetter = CredentialsGetterFactory.preview(withCredentials: withCredentials)
        let auth = KowalskiAuthClientFactory.preview()
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.createEntryFailingPreview()

        return KowalskiClient(auth: auth, stocks: stocks, portfolio: portfolio, credentialsGetter: credentialsGetter)
    }

    public static func previewWithPortfolioEntries(withCredentials: Bool) -> KowalskiClient {
        let credentialsGetter = CredentialsGetterFactory.preview(withCredentials: withCredentials)
        let auth = KowalskiAuthClientFactory.preview()
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.entriesPreview()

        return KowalskiClient(auth: auth, stocks: stocks, portfolio: portfolio, credentialsGetter: credentialsGetter)
    }

    public static func previewWithFailingPortfolioListEntries(withCredentials: Bool) -> KowalskiClient {
        let credentialsGetter = CredentialsGetterFactory.preview(withCredentials: withCredentials)
        let auth = KowalskiAuthClientFactory.preview()
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.listEntriesFailingPreview()

        return KowalskiClient(auth: auth, stocks: stocks, portfolio: portfolio, credentialsGetter: credentialsGetter)
    }

    private static func makeClient(
        url: URL,
        credentialsGetter: CredentialsGetter,
        authClient: KowalskiAuthClient,
    ) -> Client {
        let middlewares: [any ClientMiddleware] = [
            AuthenticationMiddleware(
                keychainKey: credentialsKeychainKey,
                credentialsGetter: credentialsGetter,
                authClient: authClient,
            ),
            RequiredHeadersMiddleware(),
            LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: ModuleConfig.maxLogSize)),
        ]
        let dateTranscoder = ISO8601DateTranscoder(options: [.withInternetDateTime, .withFractionalSeconds])
        let configuration = Configuration(dateTranscoder: dateTranscoder)
        let transport = URLSessionTransport()

        return Client(
            serverURL: url,
            configuration: configuration,
            transport: transport,
            middlewares: middlewares,
        )
    }

    private static func makeClientForAuth(url: URL, credentialsGetter: CredentialsGetter) -> Client {
        let middlewares: [any ClientMiddleware] = [
            RequestSigningMiddleware(keychainKey: credentialsKeychainKey, credentialsGetter: credentialsGetter),
            RefreshTokenMiddleware(credentialsGetter: credentialsGetter),
            RequiredHeadersMiddleware(),
            LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: ModuleConfig.maxLogSize)),
        ]
        let dateTranscoder = ISO8601DateTranscoder(options: [.withInternetDateTime, .withFractionalSeconds])
        let configuration = Configuration(dateTranscoder: dateTranscoder)
        let transport = URLSessionTransport()

        return Client(
            serverURL: url,
            configuration: configuration,
            transport: transport,
            middlewares: middlewares,
        )
    }
}
