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

    private let credentialsGetter: CredentialsGetter

    private init(auth: KowalskiAuthClient, stocks: KowalskiStocksClient, credentialsGetter: CredentialsGetter) {
        self.auth = auth
        self.stocks = stocks
        self.credentialsGetter = credentialsGetter
    }

    public var hasValidCredentials: Bool {
        guard let credentials = credentialsGetter.get() else { return false }
        return !credentials.isExpired
    }

    public static func `default`() -> KowalskiClient {
        let url = try! Servers.Server1.url()
        let credentialsGetter = CredentialsGetterFactory.default(keychainKey: ModuleConfig.credentialsKeychainKey)
        let client = makeClient(url: url, credentialsGetter: credentialsGetter)
        let auth = KowalskiAuthClientFactory.default(
            client: client,
            credentialsKeychainKey: ModuleConfig.credentialsKeychainKey,
            credentialsGetter: credentialsGetter
        )
        let stocks = KowalskiStocksClientFactory.deafault(client: client)

        return KowalskiClient(auth: auth, stocks: stocks, credentialsGetter: credentialsGetter)
    }

    public static func preview(withCredentials: Bool) -> KowalskiClient {
        let credentialsGetter = CredentialsGetterFactory.preview(withCredentials: withCredentials)
        let auth = KowalskiAuthClientFactory.preview()
        let stocks = KowalskiStocksClientFactory.preview()

        return KowalskiClient(auth: auth, stocks: stocks, credentialsGetter: credentialsGetter)
    }

    private static func makeClient(url: URL, credentialsGetter: CredentialsGetter) -> Client {
        let middlewares: [any ClientMiddleware] = [
            AuthenticationMiddleware(
                keychainKey: ModuleConfig.credentialsKeychainKey,
                credentialsGetter: credentialsGetter
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
            middlewares: middlewares
        )
    }
}
