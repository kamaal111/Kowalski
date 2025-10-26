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

    private init(url: URL) {
        let credentialsKeychainKey = "\(ModuleConfig.identifier).credentials"
        let credentialsGetter = CredentialsGetter(keychainKey: credentialsKeychainKey)
        let middlewares: [any ClientMiddleware] = [
            AuthenticationMiddleware(keychainKey: credentialsKeychainKey, credentialsGetter: credentialsGetter)
        ]
        let dateTranscoder = ISO8601DateTranscoder(options: [.withInternetDateTime, .withFractionalSeconds])
        let configuration = Configuration(dateTranscoder: dateTranscoder)
        let client = Client(
            serverURL: url,
            configuration: configuration,
            transport: URLSessionTransport(),
            middlewares: middlewares
        )
        self.auth = KowalskiAuthClientImpl(
            client: client,
            credentialsKeychainKey: credentialsKeychainKey,
            credentialsGetter: credentialsGetter
        )
        self.credentialsGetter = credentialsGetter
    }

    public init() {
        self.init(url: try! Servers.Server1.url())
    }

    public var hasValidCredentials: Bool {
        guard let credentials = credentialsGetter.get() else { return false }
        return !credentials.isExpired
    }
}
