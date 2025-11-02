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

    private let credentialsGetter: CredentialsGetter

    private init(auth: KowalskiAuthClient, credentialsGetter: CredentialsGetter) {
        self.auth = auth
        self.credentialsGetter = credentialsGetter
    }

    public var hasValidCredentials: Bool {
        guard let credentials = credentialsGetter.get() else { return false }
        return !credentials.isExpired
    }

    public static func `default`() -> KowalskiClient {
        let url = try! Servers.Server1.url()
        let credentialsGetter = CredentialsGetterFactory.default(keychainKey: credentialsKeychainKey)
        let client = makeClient(url: url, credentialsGetter: credentialsGetter)
        let auth = KowalskiAuthClientFactory.default(
            client: client,
            credentialsKeychainKey: credentialsKeychainKey,
            credentialsGetter: credentialsGetter
        )

        return KowalskiClient(auth: auth, credentialsGetter: credentialsGetter)
    }

    public static func preview(withCredentials: Bool) -> KowalskiClient {
        let credentialsGetter = CredentialsGetterFactory.preview(withCredentials: withCredentials)
        let auth = KowalskiAuthClientFactory.preview()

        return KowalskiClient(auth: auth, credentialsGetter: credentialsGetter)
    }

    private static let credentialsKeychainKey = "\(ModuleConfig.identifier).credentials"

    private static func makeClient(url: URL, credentialsGetter: CredentialsGetter) -> Client {
        let middlewares: [any ClientMiddleware] = [
            AuthenticationMiddleware(keychainKey: credentialsKeychainKey, credentialsGetter: credentialsGetter),
            RequiredHeadersMiddleware()
        ]
        let dateTranscoder = ISO8601DateTranscoder(options: [.withInternetDateTime, .withFractionalSeconds])
        let configuration = Configuration(dateTranscoder: dateTranscoder)

        return Client(
            serverURL: url,
            configuration: configuration,
            transport: URLSessionTransport(),
            middlewares: middlewares
        )
    }
}
