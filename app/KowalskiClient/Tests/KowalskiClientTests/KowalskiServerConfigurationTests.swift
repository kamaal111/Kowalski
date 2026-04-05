//
//  KowalskiServerConfigurationTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 4/5/26.
//

import Foundation
@testable import KowalskiClient
import Testing

@Suite("Kowalski Server Configuration Tests")
struct KowalskiServerConfigurationTests {
    @Test
    func `Forex base URL should use the same server origin as the generated client`() throws {
        let serverURL = KowalskiServerConfiguration.serverURL()
        let forexBaseURL = KowalskiServerConfiguration.forexBaseURL()
        let serverComponents = try #require(URLComponents(url: serverURL, resolvingAgainstBaseURL: false))
        let forexComponents = try #require(URLComponents(url: forexBaseURL, resolvingAgainstBaseURL: false))

        #expect(forexComponents.scheme == serverComponents.scheme)
        #expect(forexComponents.host == serverComponents.host)
        #expect(forexComponents.port == serverComponents.port)
        #expect(forexComponents.path == "/app-api/forex")
    }
}
