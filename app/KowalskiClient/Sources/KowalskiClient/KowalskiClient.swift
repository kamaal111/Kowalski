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

    public init(url: URL) {
        let credentialsKeychainKey = "\(ModuleConfig.identifier).credentials"
        let middlewares: [any ClientMiddleware] = [
            AuthenticationMiddleware(keychainKey: credentialsKeychainKey)
        ]
        let client = Client(serverURL: url, transport: URLSessionTransport(), middlewares: middlewares)
        self.auth = KowalskiAuthClientImpl(client: client, credentialsKeychainKey: credentialsKeychainKey)
        self.credentialsGetter = CredentialsGetter(keychainKey: credentialsKeychainKey)
    }

    public init() {
        self.init(url: try! Servers.Server1.url())
    }

    public var hasValidCredentials: Bool {
        guard let credentials = credentialsGetter.get() else { return false }
        return !credentials.isExpired
    }
}
