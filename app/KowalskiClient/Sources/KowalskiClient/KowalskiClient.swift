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

    private let client: Client

    public init(url: URL) {
        let client = Client(serverURL: url, transport: URLSessionTransport())
        self.client = client
        self.auth = KowalskiAuthClientImpl(client: client)
    }

    public init() {
        self.init(url: try! Servers.Server1.url())
    }
}
